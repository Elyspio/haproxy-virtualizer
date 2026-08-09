namespace Haproxy.Editor.Abstractions.Exceptions;

public abstract class ApplicationExceptionBase(string message, Exception? innerException = null) : Exception(message, innerException);

public sealed class RequestValidationException(string message) : ApplicationExceptionBase(message);

public sealed class ResourceNotFoundException(string message) : ApplicationExceptionBase(message);

public sealed class ResourceConflictException(string message) : ApplicationExceptionBase(message);

public sealed class UpstreamDependencyException(string message, Exception? innerException = null) : ApplicationExceptionBase(message, innerException);
