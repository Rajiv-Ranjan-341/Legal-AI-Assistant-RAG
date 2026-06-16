import json
from typing import Annotated, TypedDict
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from src.agents.tools import (
    search_legal_database,
    search_specific_act,
    cross_reference_sections,
    generate_compliance_checklist,
)
from src.agents.prompts import SYSTEM_PROMPT, VERIFICATION_PROMPT
from src.agents.rag_chain import query_rag
from src.llm import get_llm
from loguru import logger


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    verified: bool
    verification_attempts: int
    used_fallback: bool


TOOLS = [
    search_legal_database,
    search_specific_act,
    cross_reference_sections,
    generate_compliance_checklist,
]

MAX_VERIFICATION_ATTEMPTS = 2


def _extract_user_question(messages: list) -> str:
    for msg in messages:
        if isinstance(msg, HumanMessage):
            return msg.content
    return ""


def create_agent_graph():
    llm = get_llm()
    tool_node = ToolNode(TOOLS)

    def agent_node(state: AgentState) -> dict:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

        try:
            llm_with_tools = llm.bind_tools(TOOLS)
            response = llm_with_tools.invoke(messages)
            return {"messages": [response], "used_fallback": False}
        except Exception as e:
            logger.warning(f"Tool-calling failed ({type(e).__name__}), falling back to direct RAG")
            question = _extract_user_question(state["messages"])
            result = query_rag(question)
            fallback_msg = AIMessage(content=result["answer"])
            return {"messages": [fallback_msg], "used_fallback": True}

    def tool_node_safe(state: AgentState) -> dict:
        try:
            return tool_node.invoke(state)
        except Exception as e:
            logger.warning(f"Tool execution failed ({type(e).__name__}), falling back to direct RAG")
            question = _extract_user_question(state["messages"])
            result = query_rag(question)
            fallback_msg = AIMessage(content=result["answer"])
            return {"messages": [fallback_msg], "used_fallback": True}

    def verifier_node(state: AgentState) -> dict:
        messages = state["messages"]
        last_ai = None
        sources = []

        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not msg.tool_calls and last_ai is None:
                last_ai = msg.content
            if hasattr(msg, "content") and "Source" in str(msg.content):
                sources.append(str(msg.content))

        if not last_ai or state.get("used_fallback", False):
            return {"verified": True, "verification_attempts": state.get("verification_attempts", 0)}

        try:
            verification_llm = get_llm(temperature=0)
            prompt = VERIFICATION_PROMPT.format(
                answer=last_ai,
                sources="\n---\n".join(sources[:5]),
            )

            result = verification_llm.invoke([HumanMessage(content=prompt)])

            verification = json.loads(result.content)
            is_verified = verification.get("is_verified", True)
            issues = verification.get("issues", [])
        except Exception:
            return {"verified": True, "verification_attempts": state.get("verification_attempts", 0)}

        attempts = state.get("verification_attempts", 0) + 1

        if not is_verified and issues and attempts < MAX_VERIFICATION_ATTEMPTS:
            logger.warning(f"Verification failed (attempt {attempts}): {issues}")
            correction_msg = HumanMessage(
                content=f"Your previous answer had issues: {issues}. "
                "Please search again and correct your response."
            )
            return {
                "messages": [correction_msg],
                "verified": False,
                "verification_attempts": attempts,
            }

        return {"verified": True, "verification_attempts": attempts}

    def should_continue(state: AgentState) -> str:
        if state.get("used_fallback", False):
            return "verify"
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "verify"

    def after_verification(state: AgentState) -> str:
        if state.get("verified", False):
            return END
        return "agent"

    graph = StateGraph(AgentState)

    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node_safe)
    graph.add_node("verify", verifier_node)

    graph.set_entry_point("agent")

    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "verify": "verify"})
    graph.add_edge("tools", "agent")
    graph.add_conditional_edges("verify", after_verification, {END: END, "agent": "agent"})

    return graph.compile()
