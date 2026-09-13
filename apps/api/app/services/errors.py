class NotFoundError(Exception):
    """Recurso nao encontrado."""


class ValidationError(Exception):
    """Entrada invalida para a regra de negocio."""


class UnauthorizedError(Exception):
    """Chave de integracao ausente ou invalida."""
