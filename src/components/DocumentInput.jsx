export function DocumentInput({
  kind,
  title,
  value,
  fileName,
  reading,
  disabled,
  error = "",
  limit,
  onFileChange,
  onTextChange,
  prefix = "",
}) {
  const id = `${prefix}${kind}-text`;
  const errorId = `${prefix}${kind}-error`;
  const countId = `${prefix}${kind}-count`;
  const limitId = `${prefix}${kind}-limit-error`;
  const overLimit = value.length > limit;
  return (
    <article className="card document-input">
      <h3>{title}</h3>
      <div className="upload-area">
        <label className="upload-label" htmlFor={`${prefix}${kind}-file`}>
          Upload {title.toLowerCase()} PDF or DOCX
        </label>
        <p className="card-help">
          Text-based PDF or DOCX · up to 5 MB · PDFs up to 20 pages
        </p>
        <input
          id={`${prefix}${kind}-file`}
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          aria-label={`Upload ${title.toLowerCase()} PDF or DOCX`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          onChange={(event) => onFileChange(kind, event)}
        />
        <p className="file-status" role="status">
          {reading
            ? "Reading document..."
            : fileName || "Or paste your text below"}
        </p>
        {error ? <p id={errorId} className="error-box" role="alert">{error}</p> : null}
      </div>
      <label className="text-label" htmlFor={id}>
        {title} text
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onTextChange(kind, event.target.value)}
        placeholder={`Paste your ${title.toLowerCase()} here...`}
        disabled={disabled}
        aria-invalid={overLimit}
        aria-describedby={overLimit ? `${countId} ${limitId}` : countId}
      />
      <p
        id={countId}
        className={overLimit ? "text-count over-limit" : "text-count"}
      >
        {value.length.toLocaleString()} / {limit.toLocaleString()} characters
      </p>
      {overLimit ? (
        <p id={limitId} className="error-box" role="alert">
          Use up to {limit.toLocaleString()} characters for {title.toLowerCase()}.
        </p>
      ) : null}
    </article>
  );
}
