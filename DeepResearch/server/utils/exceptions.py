from fastapi import HTTPException, status


class DeepResearchException(Exception):
    """Base exception for all Deep Research application errors."""

    def __init__(self, message: str, error_code: str = "INTERNAL_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class AuthenticationException(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionDeniedException(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class ResourceNotFoundException(HTTPException):
    def __init__(self, resource_name: str = "Resource", resource_id: str = ""):
        detail = f"{resource_name} with ID '{resource_id}' was not found." if resource_id else f"{resource_name} not found."
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class SearchProviderException(DeepResearchException):
    def __init__(self, provider: str, detail: str):
        super().__init__(
            message=f"Search provider '{provider}' failed: {detail}",
            error_code="SEARCH_PROVIDER_ERROR"
        )


class RateLimitExceededException(HTTPException):
    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )
