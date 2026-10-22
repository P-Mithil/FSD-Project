import "../Analysis.css";
import { locateAnnotations } from "../reviewAnalysis.js";

const TYPE_LABELS = {
  improve_wording: "Improve wording",
  describe_experience: "Demonstrate existing experience",
  learn_skill: "Learn or acquire a skill",
  build_project: "Build project evidence",
};
const STATUS_LABELS = {
  matched: "Matched",
  partial: "Partial",
  missing: "Missing",
};

export function ReviewResults({ analysis, isDemo, resumeText, jobDescription }) {
  const ready = Boolean(analysis);
  const data = analysis || {
    matchScore: null, scoreExplanation: "Analyze your resume and job description above to see their evidence-based comparison.",
    annotations: [], criteria: [], matchingSkills: [], partialSkills: [], missingSkills: [], topChanges: [],
  };
  const annotations = locateAnnotations(resumeText, data.annotations);
  const byId = new Map(data.criteria.map((item) => [item.id, item]));
  const groups = [
    { title: "Matched Skills", tone: "match", items: data.matchingSkills },
    {
      title: "Partially Matched Skills",
      tone: "partial",
      items: data.partialSkills,
    },
    { title: "Missing Skills", tone: "missing", items: data.missingSkills },
  ];
  return (
    <section
      className="results analysis-results"
      id="results"
      aria-label="Resume analysis results"
    >
      {!ready ? <p className="demo-banner" role="status">
        {resumeText.trim() ? "Resume ready" : "Add your resume"} · {jobDescription?.trim() ? "Job description ready" : "Add a job description"}. No score has been calculated.
      </p> : null}
      {isDemo ? (
        <p className="demo-banner" role="status">
          Sample analysis · Fictional resume and saved results. Your documents
          were not sent to AI.
        </p>
      ) : null}
      <section className="card match-overview" aria-labelledby="overview-title">
        <div className="overview-heading">
          <p className="eyebrow">Your analysis</p>
          <h2 id="overview-title">Resume match overview</h2>
        </div>
        <div className="overview-content">
          <div className="overview-score">
            <div
              className="score-ring"
              role="img"
              aria-label={ready ? `Estimated match score: ${data.matchScore} out of 100` : "Match score unavailable"}
              style={{
                background: `conic-gradient(var(--accent) ${data.matchScore ?? 0}%, rgba(255,255,255,0.10) 0)`,
              }}
            >
              <div className="score-center" aria-hidden="true">
                <strong>{data.matchScore ?? "—"}</strong>
                <span>{ready ? "out of 100" : "Not analyzed"}</span>
              </div>
            </div>
            <p>Estimated match</p>
          </div>
          <div className="overview-summary">
            <p>{data.scoreExplanation}</p>
            <dl className="qualification-counts">
              {groups.map((group) => (
                <div key={group.tone}>
                  <dt>
                    {group.tone === "match"
                      ? "Matched"
                      : group.tone === "partial"
                        ? "Partial"
                        : "Missing"}
                  </dt>
                  <dd className={`count-${group.tone}`}>
                    {ready ? group.items.length : "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="fine-print">
              Counts include required and preferred qualifications. Transferable
              experience is a partial match.
            </p>
          </div>
        </div>
        {ready ? <ScoreBreakdown analysis={analysis} /> : <p className="fine-print">A score breakdown will appear after analysis.</p>}
      </section>

      <div className="review-layout">
        <section className="resume-review" aria-labelledby="review-title">
          <div className="section-heading tight">
            <p className="eyebrow">Resume review</p>
            <h2 id="review-title">Your resume, annotated</h2>
          </div>
          <article className="resume-paper">
            <div className="resume-paper-heading">
              <h3>Original resume</h3>
              <span className="review-badge">
                {ready ? `${annotations.length} suggestions` : "Not analyzed"}
              </span>
            </div>
            <p className="review-caption">
              Red marks wording to strengthen. Green shows a practical next
              step. Original text is preserved.
            </p>
            <AnnotatedResume
              text={resumeText || "Your resume text will appear here after uploading or pasting it above."}
              annotations={annotations}
              byId={byId}
            />
            {ready && !annotations.length ? (
              <p className="review-caption">
                No verified inline suggestions were returned. Review the skill
                gaps alongside your resume.
              </p>
            ) : null}
          </article>
        </section>
        <section className="skills-analysis" aria-labelledby="skills-title">
          <div className="section-heading tight">
            <p className="eyebrow">Skills analysis</p>
            <h2 id="skills-title">What lines up</h2>
          </div>
          <p className="card-help">
            Open a group to inspect its qualifications and supporting evidence.
          </p>
          {groups.map((group) => (
            <details
              className={`card skill-group skill-group-${group.tone}`}
              key={group.tone}
              open={group.tone === "missing"}
            >
              <summary>
                <h3>{group.title}</h3>
                <span className="review-badge">{ready ? group.items.length : "—"}</span>
              </summary>
              <FindingList items={group.items} tone={group.tone} pending={!ready} />
            </details>
          ))}
        </section>
      </div>

      <section
        className="recommendations"
        aria-labelledby="recommendations-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Your next steps</p>
          <h2 id="recommendations-title">Top 3 improvements</h2>
        </div>
        <div className="change-grid">
          {!ready ? <p className="empty-note">Three prioritized improvements will appear after analysis.</p> : null}
          {data.topChanges.map((change, index) => (
            <article
              className="card change-card"
              key={`${change.title}-${index}`}
            >
              <span className="change-number">{index + 1}</span>
              <p className="recommendation-type">
                {TYPE_LABELS[change.type] || "Demonstrate experience"}
              </p>
              <h3>{change.title}</h3>
              <p>{change.explanation}</p>
              <p className="recommendation-action">
                <strong>Try this</strong>
                {change.action}
              </p>
              <RequirementLabels
                ids={change.requirementIds || []}
                byId={byId}
              />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function RequirementLabels({ ids, byId }) {
  return (
    <span className="requirement-labels">
      {ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((item) => (
          <span
            className="requirement-label"
            key={item.id}
            data-requirement-id={item.id}
            data-priority={item.category}
          >
            {item.category === "required"
              ? "Required"
              : item.category === "preferred"
                ? "Preferred"
                : "Role evidence"}{" "}
            · {item.name}
          </span>
        ))}
    </span>
  );
}

function AnnotatedResume({ text, annotations, byId }) {
  const parts = [];
  let cursor = 0;
  annotations.forEach((item, index) => {
    parts.push(
      <span key={`text-${index}`}>{text.slice(cursor, item.start)}</span>,
    );
    parts.push(
      <span className="annotated-passage" key={`note-${index}`}>
        <mark className="resume-highlight">{item.quote}</mark>
        <span className="inline-suggestion">
          <span className="annotation-reason">
            <strong>Strengthen this:</strong> {item.explanation}
          </span>
          <span className="suggested-wording">
            <strong>Suggested improvement</strong>
            {item.suggestion}
          </span>
          <RequirementLabels ids={item.requirementIds || []} byId={byId} />
          <details className="annotation-source">
            <summary>Job requirement</summary>
            <q>{item.jdEvidence}</q>
          </details>
        </span>
      </span>,
    );
    cursor = item.start + item.quote.length;
  });
  parts.push(<span key="remaining">{text.slice(cursor)}</span>);
  return (
    <div
      className="resume-text"
      tabIndex={0}
      aria-label="Annotated resume text"
    >
      {parts}
    </div>
  );
}

function FindingList({ items, tone, pending }) {
  if (pending) return <p className="empty-note">Skills and supporting evidence will appear after analysis.</p>;
  if (!items.length)
    return <p className="empty-note">No qualifications in this group.</p>;
  return (
    <ul className="finding-list">
      {items.map((item) => (
        <li
          key={item.id}
          data-requirement-id={item.id}
          data-priority={item.priority}
        >
          <div className="skill-item-heading">
            <span className={`tag tag-${tone}`}>{item.name}</span>
            <span className="skill-priority">
              {item.priority === "required" ? "Required" : "Preferred"}
            </span>
          </div>
          {item.matchKind === "equivalent" ? (
            <span className="equivalent-note">
              Accepted alternative · full credit
            </span>
          ) : null}
          <p>{item.explanation}</p>
          {item.evidence ? (
            <blockquote>
              {item.evidence.length > 180
                ? `${item.evidence.slice(0, 177)}…`
                : item.evidence}
            </blockquote>
          ) : null}
          <details className="skill-source">
            <summary>View source</summary>
            <p>
              JD: <q>{item.jdEvidence}</q>
            </p>
            {item.evidence ? (
              <p>
                Resume: <q>{item.evidence}</q>
              </p>
            ) : null}
          </details>
        </li>
      ))}
    </ul>
  );
}

function ScoreBreakdown({ analysis }) {
  const applicable = analysis.breakdown.filter((row) => row.applicable);
  const weightTotal = applicable.reduce((sum, row) => sum + row.weight, 0);
  const terms = applicable
    .map((row) => `${row.earned}/${row.possible} × ${row.weight}`)
    .join(" + ");
  return (
    <details className="score-breakdown">
      <summary>How was this score calculated?</summary>
      <p>
        Matched = 1 point, partial = 0.5, missing = 0. Average the criteria in
        each category, then apply its weight.
      </p>
      <div className="score-table-wrap">
        <table className="score-table">
          <caption>
            Category values are rounded for display. The final formula uses the
            exact criterion fractions.
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Score</th>
              <th scope="col">Weight</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {analysis.breakdown.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{row.applicable ? `${row.score.toFixed(1)}%` : "N/A"}</td>
                <td>
                  {row.effectiveWeight.toFixed(2)}%
                  <small>default {row.weight}%</small>
                </td>
                <td>{row.contribution.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="score-formula">
        round(({terms}) ÷ {weightTotal} × 100) ={" "}
        <strong>{analysis.matchScore}/100</strong>
      </p>
      <p>
        Only categories supported by the JD are evaluated. Their original
        weights are divided by {weightTotal} to redistribute any unused weight.
      </p>
      <details className="deductions">
        <summary>Why points were deducted</summary>
        {analysis.criteria
          .filter((item) => item.status !== "matched")
          .map((item) => (
            <div className="deduction-item" key={item.id}>
              <RequirementLabels
                ids={[item.id]}
                byId={new Map([[item.id, item]])}
              />
              <p>
                {STATUS_LABELS[item.status]} ·{" "}
                {item.status === "partial" ? "0.5" : "0"}/1 criterion point.{" "}
                {item.explanation}
              </p>
            </div>
          ))}
        {analysis.criteria.every((item) => item.status === "matched") ? (
          <p>All evaluated criteria have supporting evidence.</p>
        ) : null}
      </details>
    </details>
  );
}
