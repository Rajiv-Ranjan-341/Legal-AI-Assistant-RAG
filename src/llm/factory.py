from langchain_core.language_models import BaseChatModel
from config.settings import settings


def get_llm(provider: str | None = None, **kwargs) -> BaseChatModel:
    provider = provider or settings.llm_provider

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            temperature=kwargs.get("temperature", 0.1),
            max_output_tokens=kwargs.get("max_tokens", 4096),
        )

    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.groq_model,
            groq_api_key=settings.groq_api_key,
            temperature=kwargs.get("temperature", 0.1),
            max_tokens=kwargs.get("max_tokens", 4096),
        )

    elif provider == "local":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            model=settings.local_model,
            base_url=settings.local_base_url,
            temperature=kwargs.get("temperature", 0.1),
        )

    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
