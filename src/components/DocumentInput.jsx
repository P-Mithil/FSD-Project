export function DocumentInput({
  kind,
  title,
  value,
  fileName,
  reading,
  disabled,
  limit,
  onFileChange,
  onTextChange,
  prefix = "",
  allowDocx = false,
}) {
  const id = `${prefix}${kind}-text`;
  return (
    <article className="card document-input">
      <h3>{title}</h3>
      <div className="upload-area">
        <label className="upload-label" htmlFor={`${prefix}${kind}-file`}>
          Upload {title.toLowerCase()} {allowDocx ? "PDF or DOCX" : "PDF"}
        </label>
        <p className="card-help">
          {allowDocx
            ? "Text-based PDF or DOCX · up to 5 MB · PDFs up to 20 pages"
            : "Text-based PDF · up to 5 MB · 20 pages"}
        </p>
        <input
          id={`${prefix}${kind}-file`}
          type="file"
          accept={
            allowDocx
              ? "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              : "application/pdf,.pdf"
          }
          aria-label={`Upload ${title.toLowerCase()} ${allowDocx ? "PDF or DOCX" : "PDF"}`}
          disabled={disabled}
          onChange={(event) => onFileChange(kind, event)}
        />
        <p className="file-status" role="status">
          {reading
            ? "Reading document..."
            : fileName || "Or paste your text below"}
        </p>
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
        aria-describedby={`${prefix}${kind}-count`}
      />
      <p
        id={`${prefix}${kind}-count`}
        className={
          value.length > limit ? "text-count over-limit" : "text-count"
        }
      >
        {value.length.toLocaleString()} / {limit.toLocaleString()} characters
      </p>
    </article>
  );
}
