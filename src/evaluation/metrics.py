"""
Evaluation pipeline using RAGAS metrics.

Measures:
- Faithfulness: Does the answer stick to retrieved context?
- Answer Relevancy: Is the answer relevant to the question?
- Context Precision: Are the retrieved docs precise?
- Context Recall: Did we retrieve enough relevant docs?
"""
from dataclasses import dataclass


@dataclass
class EvalSample:
    question: str
    answer: str
    contexts: list[str]
    ground_truth: str = ""


SAMPLE_EVAL_SET = [
    EvalSample(
        question="What is the punishment for murder under IPC?",
        ground_truth="Section 302 of IPC prescribes death or imprisonment for life and fine for murder.",
        answer="",
        contexts=[],
    ),
    EvalSample(
        question="What are the fundamental rights under the Indian Constitution?",
        ground_truth="Articles 14-32 of the Indian Constitution guarantee fundamental rights including right to equality, freedom, against exploitation, freedom of religion, cultural and educational rights, and right to constitutional remedies.",
        answer="",
        contexts=[],
    ),
    EvalSample(
        question="What is the procedure for filing an FIR?",
        ground_truth="Under Section 154 of CrPC, any person can give information about a cognizable offence to the officer in charge of a police station, who shall reduce it to writing.",
        answer="",
        contexts=[],
    ),
]


async def evaluate_rag_pipeline(agent_graph, eval_samples: list[EvalSample] | None = None):
    from ragas import evaluate
    from ragas.metrics import faithfulness, answer_relevancy, context_precision
    from datasets import Dataset
    from langchain_core.messages import HumanMessage

    samples = eval_samples or SAMPLE_EVAL_SET
    results = []

    for sample in samples:
        response = await agent_graph.ainvoke(
            {"messages": [HumanMessage(content=sample.question)], "verified": False, "verification_attempts": 0}
        )

        answer = ""
        contexts = []
        for msg in response["messages"]:
            if hasattr(msg, "content"):
                content = str(msg.content)
                if "Source" in content:
                    contexts.append(content)
                elif len(content) > 50:
                    answer = content

        results.append({
            "question": sample.question,
            "answer": answer,
            "contexts": contexts,
            "ground_truth": sample.ground_truth,
        })

    dataset = Dataset.from_list(results)

    eval_result = evaluate(
        dataset=dataset,
        metrics=[faithfulness, answer_relevancy, context_precision],
    )

    return eval_result
