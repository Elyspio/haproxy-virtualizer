namespace Haproxy.Editor.Abstractions.Data;

public record ValidationResult(bool IsValid, string? ErrorMessage = null) : IValidationResult
{
	public static implicit operator ValidationResult(Exception err) => new(false, err.Message);
}

public record ValidationResult<T>(T? Data, bool IsValid, string? ErrorMessage = null) : IValidationResult
{
	public static implicit operator ValidationResult<T>(T result) => new(result, true);
	public static implicit operator ValidationResult<T>(Exception err) => new(default, false, err.Message);
}

/// <summary>
///     Describes whether validation succeeded and, when it did not, why it failed.
/// </summary>
public interface IValidationResult
{
	/// <summary>
	///     Gets whether the validated value is valid.
	/// </summary>
	bool IsValid { get; }

	/// <summary>
	///     Gets the validation error message, or <see langword="null" /> when validation succeeded.
	/// </summary>
	string? ErrorMessage { get; }
}
