"""Erros controlados do provador com foto.

Todos carregam um `code` estavel (consumido pelo frontend) e um status HTTP. As mensagens
nunca expoem detalhes internos do provider (caminhos, stack traces, GPU).
"""

from __future__ import annotations


class TryOnError(Exception):
    code = "tryon_error"
    status_code = 500
    retry_after: int | None = None

    def __init__(self, message: str | None = None, *, retry_after: int | None = None) -> None:
        super().__init__(message or self.default_message())
        if retry_after is not None:
            self.retry_after = retry_after

    @classmethod
    def default_message(cls) -> str:
        return "Não foi possível gerar a visualização."

    def to_payload(self) -> dict:
        payload: dict = {"detail": str(self), "code": self.code}
        if self.retry_after:
            payload["retry_after_seconds"] = self.retry_after
        return payload


# ---- entrada / regras de negocio -------------------------------------------
class TryOnDisabledError(TryOnError):
    code = "tryon_disabled"
    status_code = 503

    @classmethod
    def default_message(cls) -> str:
        return "O provador com foto está desativado neste ambiente."


class ConsentRequiredError(TryOnError):
    code = "consent_required"
    status_code = 422

    @classmethod
    def default_message(cls) -> str:
        return "Aceite o processamento da foto para continuar."


class InvalidSizeError(TryOnError):
    code = "invalid_size"
    status_code = 422


class FlatImageUnavailableError(TryOnError):
    code = "flat_image_unavailable"
    status_code = 422

    @classmethod
    def default_message(cls) -> str:
        return "Esta peça ainda não possui imagem compatível com o provador com foto."


class InvalidPhotoError(TryOnError):
    code = "invalid_photo"
    status_code = 400


class PhotoTooLargeError(TryOnError):
    code = "photo_too_large"
    status_code = 413


class UnsupportedPhotoTypeError(TryOnError):
    code = "unsupported_photo_type"
    status_code = 415


# ---- provider --------------------------------------------------------------
class ProviderError(TryOnError):
    """Base dos erros vindos do provider (ja traduzidos)."""

    code = "provider_error"
    status_code = 502

    @classmethod
    def default_message(cls) -> str:
        return "Não foi possível gerar a visualização."


class ProviderUnavailableError(ProviderError):
    code = "provider_unavailable"
    status_code = 503

    @classmethod
    def default_message(cls) -> str:
        return "A visualização em IA está temporariamente indisponível."


class ProviderBusyError(ProviderError):
    code = "provider_busy"
    status_code = 503
    retry_after = 10

    @classmethod
    def default_message(cls) -> str:
        return "O provador está ocupado no momento. Tente novamente em instantes."


class ProviderTimeoutError(ProviderError):
    code = "provider_timeout"
    status_code = 504

    @classmethod
    def default_message(cls) -> str:
        return "A geração demorou mais que o esperado."


class ProviderOutOfMemoryError(ProviderError):
    code = "provider_out_of_memory"
    status_code = 503
    retry_after = 30

    @classmethod
    def default_message(cls) -> str:
        return "A visualização em IA está temporariamente indisponível."


class ProviderRejectedInputError(ProviderError):
    """O provider recusou a foto/peca (imagem invalida, dimensoes, etc.)."""

    code = "provider_rejected_input"
    status_code = 422

    @classmethod
    def default_message(cls) -> str:
        return "A foto enviada não pôde ser processada. Use uma foto frontal, nítida e de corpo inteiro."


class ResultNotFoundError(TryOnError):
    code = "result_not_found"
    status_code = 404

    @classmethod
    def default_message(cls) -> str:
        return "Visualização não encontrada."


class ResultExpiredError(TryOnError):
    code = "result_expired"
    status_code = 410

    @classmethod
    def default_message(cls) -> str:
        return "O resultado expirou. Gere uma nova visualização."
