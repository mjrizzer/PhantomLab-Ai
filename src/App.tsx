import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  ScanLine,
  WifiOff,
  Pause,
  Download,
  X,
  Check,
  Activity,
  Menu,
} from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "@xyflow/react/dist/style.css";
import {
  cache,
  cached,
  cacheLaboratory,
  local,
  request,
  sync,
  saveNote,
} from "./offline";
import {
  type Experiment,
  type Product,
  type Health,
  type Result,
  SCENARIOS,
  pretty,
} from "./types";

const pages = [
  ["observatory", "The Observatory"],
  ["registry", "Product Registry"],
  ["studio", "Experiment Studio"],
  ["personas", "Persona Theatre"],
  ["evidence", "Evidence Room"],
  ["compare", "Release Time Machine"],
  ["atlas", "Collision Atlas"],
  ["risk", "Risk Atelier"],
  ["journal", "Findings Journal"],
  ["services", "Local Services"],
];
const personaNames = [
  "The First-Timer",
  "The Impatient Buyer",
  "The Cautious User",
  "The Keyboard User",
  "The Slow Network User",
  "The Edge-Case Explorer",
];
const personaGoals = [
  "Find a way from discovery to a completed order.",
  "Try rapid repeated submission with fake payment data.",
  "Review the bag, quantities, and price before committing.",
  "Reach every checkout action without a pointer.",
  "Keep feedback truthful while a local request is delayed.",
  "Explore valid discount and quantity boundaries.",
];
const date = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
const monoTime = (s: string) => new Date(s).toLocaleTimeString();
const bytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
const isActive = (e?: Experiment) =>
  !!e && ["running", "queued"].includes(e.status);
function Link({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href={"#" + to}>
      {children}
    </a>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <ScanLine size={30} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function CaptureImage({
  src,
  alt,
  className,
  available,
}: {
  src?: string;
  alt: string;
  className?: string;
  available: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src, available]);
  return available && src && !failed ? (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="capture-unavailable">
      <ScanLine size={24} />
      <p>
        {available
          ? "This captured artifact is unavailable."
          : "Screenshots stay on local backend disk. Reconnect to inspect this capture."}
      </p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "tag " +
        (value === "passed" || value === "completed"
          ? "success"
          : value === "failed"
            ? "failure"
            : "")
      }
    >
      {value.replace("_", " ")}
    </span>
  );
}
function PageTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="page-title">
      <span className="eyebrow">FIELD {number} / PHANTOMLAB</span>
      <h1>
        {title}
        <span className="burgundy">.</span>
      </h1>
      <p>{subtitle}</p>
    </header>
  );
}

export default function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "observatory");
  const [menu, setMenu] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [health, setHealth] = useState<Health>();
  const [backend, setBackend] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [mode, setMode] = useState("manual");
  const [objective, setObjective] = useState(
    "Investigate the Double Checkout Paradox. Is the candidate checkout safe under repeated submission?",
  );
  const [persona, setPersona] = useState("The Impatient Buyer");
  const [personaOverrides, setPersonaOverrides] = useState<
    Record<string, string>
  >({});
  const [scenarios, setScenarios] = useState(SCENARIOS);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const [jobs, prods, h] = await Promise.all([
        request<Experiment[]>("/experiments"),
        request<Product[]>("/products"),
        request<Health>("/health"),
      ]);
      setExperiments(jobs);
      setProducts(prods);
      setHealth(h);
      setBackend(true);
      await cacheLaboratory(jobs, prods).catch((error) =>
        setNotice(String(error)),
      );
      await sync();
      setPending(await local.operations.count());
    } catch {
      setBackend(false);
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    void Promise.all([
      cached<Experiment[]>("experiments"),
      cached<Product[]>("products"),
      cached<{ objective: string; persona: string }>("draft:experiment"),
    ]).then(([e, p, d]) => {
      if (!mounted) return;
      if (e) setExperiments(e);
      if (p) setProducts(p);
      if (d) {
        setObjective(d.objective);
        setPersona(d.persona);
      }
    });
    void refresh();
    void Promise.all(
      personaNames.map(
        async (name) =>
          [
            name,
            (await cached<{ goal: string }>("draft:persona:" + name))?.goal,
          ] as const,
      ),
    ).then((rows) =>
      setPersonaOverrides(
        Object.fromEntries(
          rows.filter((r): r is readonly [string, string] => !!r[1]),
        ),
      ),
    );
    const timer = setInterval(() => void refresh(), 3500);
    const hash = () => {
      setPage(location.hash.slice(1) || "observatory");
      setMenu(false);
      window.scrollTo(0, 0);
    };
    const net = () => setOnline(navigator.onLine);
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
    };
  }, [refresh]);
  const current = experiments.find((e) => e.id === selected) || experiments[0];
  const failures = experiments.flatMap((e) =>
    e.results
      .filter((r) => r.status === "failed")
      .map((r) => ({ ...r, experiment: e.id })),
  );
  const completed = experiments.filter((e) => e.status === "completed").length;
  async function begin(e?: FormEvent) {
    e?.preventDefault();
    if (!backend) {
      await cache("draft:experiment", { objective, persona, scenarios });
      setNotice("Plan saved on this device. Reconnect the backend to begin.");
      setNewOpen(false);
      return;
    }
    setBusy(true);
    try {
      const job = await request<Experiment>("/experiments", {
        method: "POST",
        body: JSON.stringify({
          objective,
          persona,
          mode,
          scenarios,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setSelected(job.id);
      setNewOpen(false);
      location.hash = "studio";
      await refresh();
    } catch (error) {
      setNotice(String(error));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!current) return;
    try {
      await request("/experiments/" + current.id + "/cancel", {
        method: "POST",
      });
      await refresh();
    } catch (e) {
      setNotice(String(e));
    }
  }
  const openNew = () => setNewOpen(true);
  const stage = backend
    ? online
      ? "LOCAL LABORATORY — ACTIVE"
      : "INTERNET UNAVAILABLE — LOCAL EXPERIMENTS READY"
    : "BACKEND DISCONNECTED — ARCHIVE MODE";
  return (
    <>
      <div className="top-rule" />
      <header className="masthead">
        <Link to="observatory" className="brand">
          p<span className="brand-dot">.</span>
          <span>PHANTOMLAB</span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["observatory", "Observatory"],
            ["studio", "Studio"],
            ["evidence", "Evidence"],
            ["compare", "Compare"],
            ["journal", "Journal"],
          ].map(([id, label]) => (
            <Link key={id} to={id} className={page === id ? "active" : ""}>
              {label}
            </Link>
          ))}
          <button
            className={"nav-more " + (menu ? "active" : "")}
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-label="All laboratory rooms"
          >
            <Menu size={15} />
            Index
          </button>
        </nav>
        <Link to="services" className="mast-status">
          <i className={backend ? "dot" : "dot muted"} />
          {backend ? "LOCAL ENGINE" : "ARCHIVE MODE"}
        </Link>
        {menu && (
          <div className="index-menu">
            {pages.map(([id, title], i) => (
              <Link key={id} to={id}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {title}
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        )}
      </header>
      <div className="edition-line">
        <span>AN INDEPENDENT LABORATORY FOR SOFTWARE PRODUCTS</span>
        <span>
          LOCAL-FIRST / NO. {String(experiments.length).padStart(3, "0")}
        </span>
      </div>
      {!backend && (
        <div className="connection-note">
          <WifiOff size={14} />
          {stage}
          <span>Saved findings and drafts remain available.</span>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      <main>
        {page === "observatory" && (
          <>
            <section className="cover">
              <div className="cover-title">
                <span className="eyebrow">
                  THE OBSERVATORY <span>01 — OPEN FOR INQUIRY</span>
                </span>
                <h1>
                  PhantomLab<span className="burgundy">.</span>
                </h1>
                <div className="cover-sub">
                  <p>
                    Every release
                    <br />
                    has a story.
                  </p>
                  <p className="italic">
                    Find out what
                    <br />
                    it’s not telling you.
                  </p>
                  <span className="cover-note">
                    Observe carefully.
                    <br />
                    Test deliberately.
                    <br />
                    Keep the evidence.
                  </span>
                </div>
              </div>
              <div className="cover-bottom">
                <p>
                  A living laboratory for software products.
                  <br />
                  Local intelligence. Real experiments. Reproducible findings.
                </p>
                <button className="primary" onClick={openNew}>
                  Begin a New Experiment <Plus size={17} />
                </button>
              </div>
            </section>
            <section className="featured-grid">
              <div className="feature-story">
                <span className="eyebrow">
                  <span className="square" /> THE SIGNATURE INVESTIGATION
                </span>
                <Link to="studio">
                  <h2>
                    The Double
                    <br />
                    Checkout <em>Paradox.</em>
                  </h2>
                </Link>
                <p className="reading">
                  One intention. Two orders. What happens when a new checkout
                  meets an impatient click?
                </p>
                <div className="specimen-label">
                  <span>ATELIER COMMERCE</span>
                  <span>RELEASE A ↔ B</span>
                </div>
                <div className="story-bottom">
                  <button
                    className="text-button"
                    onClick={() =>
                      current ? (location.hash = "studio") : openNew()
                    }
                  >
                    {current ? "Enter investigation" : "Begin investigation"}{" "}
                    <ArrowUpRight size={18} />
                  </button>
                  <span className="mono">
                    {current?.status.toUpperCase() || "READY TO INVESTIGATE"}
                  </span>
                </div>
              </div>
              <div className="instrument-panel">
                <div className="instrument-top">
                  <span className="eyebrow">EXPERIMENTAL APPARATUS</span>
                  <span className="mono">FIG. 01</span>
                </div>
                <Apparatus results={current?.results || []} />
                <div className="instrument-caption">
                  <span>INTENT → INTERACTION → EVIDENCE</span>
                  <span>CONTROLLED LOCAL ENVIRONMENT</span>
                </div>
              </div>
              <aside className="lab-margin">
                <div className="stat">
                  <span className="eyebrow">EXPERIMENTS COMPLETED</span>
                  <strong>{String(completed).padStart(2, "0")}</strong>
                  <p>
                    Inquiries preserved.
                    <br />
                    Ready to be revisited.
                  </p>
                </div>
                <div className="model-status">
                  <span className="eyebrow">THE LOCAL INTELLIGENCE</span>
                  <div className="wave" aria-hidden="true">
                    {[9, 19, 28, 13, 33, 21, 12, 26, 17, 8].map((h, i) => (
                      <i
                        key={i}
                        style={{ height: h, animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                  <p>{health?.ollama.model || "qwen3.5:4b"}</p>
                  <span className="mono">
                    {backend && health?.ollama.available
                      ? "MODEL AVAILABLE"
                      : "AI MODEL UNAVAILABLE"}
                  </span>
                </div>
                <Link to="services" className="local-note">
                  <i className={backend ? "dot" : "dot muted"} />
                  <span>
                    {backend
                      ? "Your laboratory is local."
                      : "Archive mode is available."}
                    <small>
                      {online
                        ? "Internet reported available"
                        : "Internet reported unavailable"}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              </aside>
            </section>
            <section className="observations">
              <div>
                <div className="section-heading">
                  <span className="eyebrow">RECENT INQUIRIES</span>
                  <Link to="journal">
                    Findings archive <ArrowUpRight size={14} />
                  </Link>
                </div>
                {experiments.length ? (
                  experiments.slice(0, 3).map((j, i) => (
                    <button
                      className="inquiry-row"
                      key={j.id}
                      onClick={() => {
                        setSelected(j.id);
                        location.hash = "studio";
                      }}
                    >
                      <span className="row-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{j.title}</strong>
                        <small>
                          {j.id} / {date(j.created)}
                        </small>
                      </span>
                      <Status value={j.status} />
                      <ArrowUpRight size={18} />
                    </button>
                  ))
                ) : (
                  <div className="empty-line">
                    <span className="italic">
                      A clean notebook. A first question.
                    </span>
                    <p>
                      Begin an experiment to create your first evidence record.
                    </p>
                  </div>
                )}
              </div>
              <div className="latest-finding">
                <span className="eyebrow">LATEST OBSERVATION</span>
                {failures[0] ? (
                  <>
                    <span className="finding-code">{failures[0].id}</span>
                    <h3>{pretty(failures[0].scenario)}</h3>
                    <p>{failures[0].assertion}</p>
                    <Link to="evidence">
                      Inspect the evidence <ArrowUpRight size={15} />
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="italic large-italic">
                      Nothing assumed.
                      <br />
                      Everything observed.
                    </span>
                    <p>
                      Verified failures will appear here after an experiment.
                      The notebook starts empty.
                    </p>
                  </>
                )}
              </div>
            </section>
          </>
        )}
        {page === "registry" && (
          <>
            <PageTitle
              number="02"
              title="Product Registry"
              subtitle="Every investigation begins with a well-defined specimen."
            />
            <ProductRegistry
              products={products}
              backend={backend}
              reload={refresh}
              onNotice={setNotice}
            />
          </>
        )}
        {page === "studio" && (
          <>
            <PageTitle
              number="03"
              title="Experiment Studio"
              subtitle="Plan a question. Observe the interaction. Let the evidence answer."
            />
            <div className="toolbar">
              <ExperimentSelector
                experiments={experiments}
                current={current}
                select={setSelected}
              />
              <span className="mono">
                {current?.mode === "ai"
                  ? "LOCAL AI INVESTIGATION"
                  : "DETERMINISTIC / MANUAL MODE"}
              </span>
              {isActive(current) ? (
                <button className="danger" onClick={() => void cancel()}>
                  <Pause size={14} />
                  Stop experiment
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    if (current) {
                      setObjective(current.objective);
                      setPersona(current.persona || persona);
                      setScenarios(current.scenarios || SCENARIOS);
                      setMode(
                        health?.ollama.available ? current.mode : "manual",
                      );
                    }
                    openNew();
                  }}
                >
                  {current ? "Replay Experiment" : "Begin Experiment"}{" "}
                  <Plus size={15} />
                </button>
              )}
            </div>
            {current ? (
              <Studio experiment={current} backend={backend} />
            ) : (
              <Empty
                title="The stage is ready."
                detail="Begin the Double Checkout Paradox to see actual browser captures, assertions, and agent activity."
              />
            )}
          </>
        )}
        {page === "personas" && (
          <>
            <PageTitle
              number="04"
              title="Persona Theatre"
              subtitle="Different constraints. Better questions. Personas guide tests; they do not predict human psychology."
            />
            <div className="persona-grid">
              {personaNames.map((name, i) => (
                <article
                  key={name}
                  className={"persona " + (persona === name ? "selected" : "")}
                >
                  <span className="eyebrow">PERSONA / 0{i + 1}</span>
                  <div className="persona-glyph" aria-hidden="true">
                    {["↗", "↯", "↶", "⌘", "≈", "∴"][i]}
                  </div>
                  <h2>{name}</h2>
                  <p>{personaGoals[i]}</p>
                  <label className="eyebrow">
                    Goal
                    <input
                      aria-label={name + " goal"}
                      value={personaOverrides[name] ?? personaGoals[i]}
                      maxLength={1500}
                      onChange={(e) =>
                        setPersonaOverrides((old) => ({
                          ...old,
                          [name]: e.target.value,
                        }))
                      }
                      onBlur={(e) =>
                        void cache("draft:persona:" + name, {
                          goal: e.target.value,
                        })
                      }
                    />
                  </label>
                  <p className="mono">
                    REVIEWED TOOLS ONLY · MAX 10 BROWSER RUNS
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setPersona(name);
                      setObjective(
                        (personaOverrides[name] ?? personaGoals[i]) +
                          " Investigate baseline and candidate checkout.",
                      );
                      openNew();
                    }}
                  >
                    {persona === name
                      ? "Selected for inquiry"
                      : "Use this persona"}
                    <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {page === "evidence" && (
          <>
            <PageTitle
              number="05"
              title="The Evidence Room"
              subtitle="An assertion is only as useful as the evidence that survives it."
            />
            <div className="toolbar">
              <ExperimentSelector
                experiments={experiments}
                current={current}
                select={setSelected}
              />
              <span className="mono">
                {current?.results.length || 0} RECORDED EXECUTIONS
              </span>
            </div>
            <Evidence experiment={current} backend={backend} />
          </>
        )}
        {page === "compare" && (
          <>
            <PageTitle
              number="06"
              title="Compare Realities"
              subtitle="The same question. Two releases. A precise account of what changed."
            />
            <div className="toolbar">
              <ExperimentSelector
                experiments={experiments}
                current={current}
                select={setSelected}
              />
              <span className="mono">ATELIER COMMERCE / A ↔ B</span>
            </div>
            <Comparison experiment={current} backend={backend} />
          </>
        )}
        {page === "atlas" && (
          <>
            <PageTitle
              number="07"
              title="The Collision Atlas"
              subtitle="Follow the registered connections between a feature, its journeys, and the failures observed along the way."
            />
            <Atlas backend={backend} />
          </>
        )}
        {page === "risk" && (
          <>
            <PageTitle
              number="08"
              title="Risk Atelier"
              subtitle="Measure what is known. Be explicit about what is uncertain."
            />
            <Risk experiment={current} experiments={experiments} />
          </>
        )}
        {page === "journal" && (
          <>
            <PageTitle
              number="09"
              title="Findings Journal"
              subtitle="An investigation, written for the next person who needs to understand it."
            />
            <div className="toolbar">
              <ExperimentSelector
                experiments={experiments}
                current={current}
                select={setSelected}
              />
              {current && (
                <div className="button-group">
                  <a
                    className="button"
                    href={"/api/reports/" + current.id + ".pdf"}
                    aria-disabled={!backend}
                  >
                    <Download size={14} />
                    PDF
                  </a>
                  <button
                    onClick={() => {
                      const b = new Blob([JSON.stringify(current, null, 2)], {
                        type: "application/json",
                      });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(b);
                      a.download = current.id + ".json";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    <Download size={14} />
                    JSON
                  </button>
                  <button onClick={() => window.print()}>Print</button>
                </div>
              )}
            </div>
            <Journal
              experiment={current}
              backend={backend}
              notice={setNotice}
            />
          </>
        )}
        {page === "services" && (
          <>
            <PageTitle
              number="10"
              title="Local, by Design"
              subtitle="A quiet engine on your own machine. Every service accounted for."
            />
            <Services
              health={health}
              backend={backend}
              online={online}
              pending={pending}
              refresh={refresh}
            />
          </>
        )}
        {!pages.some(([id]) => id === page) && (
          <Empty
            title="This room is not in the index."
            detail="Use the masthead index to return to the laboratory."
          />
        )}
      </main>
      <footer className="footer">
        <span className="footer-logo">
          PhantomLab<span className="burgundy">.</span>
        </span>
        <p>Independent inquiry. Reproducible evidence.</p>
        <Link to="services">
          <i className={backend ? "dot" : "dot muted"} />
          {stage}
          <ArrowUpRight size={14} />
        </Link>
        <span className="mono">EST. 2026 / LOCAL EDITION</span>
      </footer>
      {newOpen && (
        <div className="modal-backdrop" onClick={() => setNewOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setNewOpen(false);
                return;
              }
              if (event.key === "Tab") {
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled),input:not(:disabled),textarea,select",
                  ),
                );
                const first = controls[0],
                  last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <button
              className="close"
              onClick={() => setNewOpen(false)}
              aria-label="Close experiment form"
            >
              <X />
            </button>
            <span className="eyebrow">A NEW LINE OF INQUIRY</span>
            <h2 id="new-title">
              Begin an <em>experiment.</em>
            </h2>
            <p>Atelier Commerce / Baseline A + Candidate B</p>
            <form onSubmit={(e) => void begin(e)}>
              <label>
                Investigation objective
                <textarea
                  autoFocus
                  value={objective}
                  minLength={10}
                  maxLength={2000}
                  required
                  onChange={(e) => setObjective(e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  Investigation mode
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="manual">Deterministic / manual</option>
                    <option
                      value="ai"
                      disabled={!backend || !health?.ollama.available}
                    >
                      Local AI / Qwen3.5 4B
                    </option>
                  </select>
                </label>
                <label>
                  Persona
                  <select
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                  >
                    {personaNames.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>Reviewed browser tools</legend>
                {SCENARIOS.map((s) => (
                  <label className="check-label" key={s}>
                    <input
                      type="checkbox"
                      checked={scenarios.includes(s)}
                      onChange={() =>
                        setScenarios((old) =>
                          old.includes(s)
                            ? old.filter((x) => x !== s)
                            : [...old, s],
                        )
                      }
                    />
                    {pretty(s)}
                  </label>
                ))}
              </fieldset>
              <p className="small-reading">
                One browser at a time. Fake guest sessions. Only the controlled
                localhost shop is executable in this checkpoint. AI can select
                reviewed scenarios; it cannot run arbitrary code.
              </p>
              <button
                className="primary"
                type="submit"
                disabled={busy || scenarios.length === 0}
              >
                {busy
                  ? "Queuing…"
                  : backend
                    ? "Begin Experiment"
                    : "Save offline draft"}
                <ArrowRight size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function Apparatus({ results }: { results: Result[] }) {
  const a = results.filter((r) => r.release === "A"),
    b = results.filter((r) => r.release === "B");
  return (
    <svg
      className="apparatus"
      viewBox="0 0 440 380"
      role="img"
      aria-label="Checkout comparison schematic. Actual assertion counts are shown when available."
    >
      <defs>
        <pattern
          id="fine-grid"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 22 0 L 0 0 0 22"
            fill="none"
            stroke="#d8d0c3"
            strokeWidth=".5"
          />
        </pattern>
      </defs>
      <rect width="440" height="380" fill="url(#fine-grid)" />
      <circle cx="220" cy="187" r="141" fill="none" stroke="#d8d0c3" />
      <circle
        cx="220"
        cy="187"
        r="112"
        fill="none"
        stroke="#b8b0a4"
        strokeDasharray="2 6"
      />
      <path d="M20 187H420 M220 15V360" stroke="#c1b8ab" strokeWidth=".6" />
      <path
        d="M105 125L220 187 335 125M220 187L105 270M220 187L335 270"
        stroke="#762e3a"
        fill="none"
        strokeWidth="1.2"
      />
      <circle cx="220" cy="187" r="49" fill="#F5F1E8" stroke="#762e3a" />
      <text
        x="220"
        y="181"
        textAnchor="middle"
        fontFamily="Georgia"
        fontSize="35"
        fill="#762e3a"
      >
        2×
      </text>
      <text
        x="220"
        y="204"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="2"
      >
        ONE INTENTION
      </text>
      {[
        [105, 125, "A"],
        [335, 125, "B"],
      ].map(([x, y, t]) => (
        <g key={t}>
          <circle cx={x} cy={y} r="24" fill="#F5F1E8" stroke="#181818" />
          <text
            x={x}
            y={Number(y) + 6}
            textAnchor="middle"
            fontFamily="Georgia"
            fontSize="21"
          >
            {t}
          </text>
        </g>
      ))}
      <rect
        x="60"
        y="250"
        width="90"
        height="42"
        fill="#F5F1E8"
        stroke="#596b54"
      />
      <rect
        x="290"
        y="250"
        width="90"
        height="42"
        fill="#F5F1E8"
        stroke="#762e3a"
      />
      <text
        x="105"
        y="268"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
      >
        BASELINE
      </text>
      <text
        x="105"
        y="282"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
      >
        {a.length
          ? `${a.filter((r) => r.passed).length}/${a.length} VERIFIED`
          : "AWAITING TEST"}
      </text>
      <text
        x="335"
        y="268"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
      >
        CANDIDATE
      </text>
      <text
        x="335"
        y="282"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
      >
        {b.length
          ? `${b.filter((r) => !r.passed).length} NON-PASSING`
          : "AWAITING TEST"}
      </text>
      <text
        x="220"
        y="34"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="2"
      >
        THE DOUBLE CHECKOUT PARADOX
      </text>
      <text
        x="220"
        y="339"
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="8"
        letterSpacing="1"
      >
        SCHEMATIC / NOT A LIVE BROWSER VIEW
      </text>
      <path
        d="M12 12H30M12 12V30 M428 12H410M428 12V30 M12 368H30M12 368V350 M428 368H410M428 368V350"
        fill="none"
        stroke="#762e3a"
      />
    </svg>
  );
}
function ExperimentSelector({
  experiments,
  current,
  select,
}: {
  experiments: Experiment[];
  current?: Experiment;
  select: (id: string) => void;
}) {
  return (
    <label className="experiment-select">
      <span className="eyebrow">EXPERIMENT</span>
      <select
        aria-label="Selected experiment"
        value={current?.id || ""}
        onChange={(e) => select(e.target.value)}
      >
        {!experiments.length && <option value="">No experiments yet</option>}
        {experiments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id} · {e.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function Studio({
  experiment: e,
  backend,
}: {
  experiment: Experiment;
  backend: boolean;
}) {
  const [left, setLeft] = useState(24);
  const [right, setRight] = useState(26);
  const [capture, setCapture] = useState("");
  const captures = e.events.filter((v) => v.screenshot);
  const screenshot = capture || captures.at(-1)?.screenshot;
  const latest = e.results.at(-1);
  return (
    <>
      <div className="resize-controls">
        <label>
          Plan width{" "}
          <input
            type="range"
            min="18"
            max="32"
            value={left}
            onChange={(x) => setLeft(+x.target.value)}
          />
        </label>
        <label>
          Evidence width{" "}
          <input
            type="range"
            min="20"
            max="34"
            value={right}
            onChange={(x) => setRight(+x.target.value)}
          />
        </label>
        <Status value={e.status} />
      </div>
      <div
        className="studio"
        style={{
          gridTemplateColumns: `${left}% ${100 - left - right}% ${right}%`,
        }}
      >
        <aside className="studio-plan">
          <span className="eyebrow">01 / INVESTIGATION PLAN</span>
          <h2>{e.title}</h2>
          <p>{e.objective}</p>
          <div className="plan-list">
            {SCENARIOS.map((s, i) => {
              const r = e.results.filter((r) => r.scenario === s);
              return (
                <div key={s}>
                  <span className="mono">0{i + 1}</span>
                  <span>{pretty(s)}</span>
                  {r.length === 2 ? (
                    <span
                      className={
                        r.every((x) => x.passed) ? "green" : "burgundy"
                      }
                    >
                      {r.filter((x) => x.passed).length}/2
                    </span>
                  ) : (
                    <span className="mono">—</span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="eyebrow">
            AGENT ACTIVITY / {e.mode === "ai" ? "OLLAMA" : "TOOLS ONLY"}
          </span>
          <div className="agent-feed">
            {e.events.slice(-14).map((v, i) => (
              <article key={i}>
                <span className="mono">
                  {monoTime(v.at)} / {v.actor}
                </span>
                <p>{v.message}</p>
              </article>
            ))}
          </div>
        </aside>
        <section className="browser-stage">
          <header>
            <span className="eyebrow">02 / CAPTURED BROWSER STAGE</span>
            <span className="mono">
              {isActive(e) ? "MONITORING CAPTURES" : "RECORDED EVIDENCE"}
            </span>
          </header>
          <div className="browser-chrome">
            <span>● ● ●</span>
            <code>127.0.0.1 / atelier-commerce</code>
            <ScanLine size={13} />
          </div>
          {screenshot ? (
            <a href={screenshot} target="_blank" rel="noreferrer">
              <CaptureImage
                className="stage-image"
                src={screenshot}
                alt="Actual Playwright capture of Atelier Commerce"
                available={backend}
              />
            </a>
          ) : (
            <Empty
              title={
                isActive(e)
                  ? "Investigation in progress."
                  : "No browser capture yet."
              }
              detail={
                e.mode === "ai"
                  ? "Local agents plan sequentially before browser tools execute."
                  : "Captured screenshots appear as browser steps complete."
              }
            />
          )}
          <div className="capture-timeline">
            {captures.map((v, i) => (
              <button
                key={i}
                title={`${v.release} / ${v.scenario} / ${v.message}`}
                className={capture === v.screenshot ? "selected" : ""}
                onClick={() => setCapture(v.screenshot!)}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
          <p className="stage-note">
            {capture
              ? "Selected historical capture."
              : "Most recent captured screenshot."}{" "}
            This is not a live video stream.
          </p>
        </section>
        <aside className="studio-evidence">
          <span className="eyebrow">03 / EVIDENCE COLLECTED</span>
          <div className="evidence-count">
            <strong>{e.results.length}</strong>
            <span>
              executions
              <br />
              preserved
            </span>
          </div>
          {latest && (
            <>
              <Status value={latest.status} />
              <h3>{pretty(latest.scenario)}</h3>
              <p>{latest.assertion || latest.error}</p>
              <pre>{JSON.stringify(latest.evidence, null, 2)}</pre>
              <Link to="evidence" className="text-button">
                Open evidence record
                <ArrowUpRight size={15} />
              </Link>
            </>
          )}
          {e.risk && (
            <div className="verdict-small">
              <span className="eyebrow">READINESS VERDICT</span>
              <h3>{e.risk.verdict}</h3>
              <p>{e.risk.reason}</p>
              <span className="mono">{e.risk.mode}</span>
            </div>
          )}
          {e.error && <p role="alert">{e.error}</p>}
        </aside>
      </div>
    </>
  );
}

function ProductRegistry({
  products,
  backend,
  reload,
  onNotice,
}: {
  products: Product[];
  backend: boolean;
  reload: () => Promise<void>;
  onNotice: (s: string) => void;
}) {
  const [show, setShow] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request("/products", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setShow(false);
      await reload();
    } catch (err) {
      onNotice(String(err));
    }
  }
  return (
    <>
      <div className="toolbar">
        <span className="mono">
          {products.length} REGISTERED SPECIMENS / LOCALHOST ONLY
        </span>
        <button
          className="primary"
          disabled={!backend}
          onClick={() => setShow(!show)}
        >
          Register product
          <Plus size={15} />
        </button>
      </div>
      {show && (
        <form className="registry-form" onSubmit={(e) => void submit(e)}>
          {[
            ["name", "Product name", "text"],
            ["description", "Description", "text"],
            ["url", "Local URL", "url"],
            ["release", "Release identifier", "text"],
            ["category", "Category", "text"],
          ].map(([id, label, type]) => (
            <label key={id}>
              {label}
              <input
                name={id}
                type={type}
                required
                placeholder={id === "url" ? "http://127.0.0.1:3000" : ""}
              />
            </label>
          ))}
          <p>
            Registration stores metadata. This checkpoint executes only the
            reviewed Atelier Commerce tools. External domains are disabled.
          </p>
          <button className="primary">Register specimen</button>
        </form>
      )}
      <div className="product-list">
        {products.map((p, i) => (
          <article key={p.id}>
            <span className="editorial-number">0{i + 1}</span>
            <div>
              <span className="eyebrow">
                {p.category} / {p.id}
              </span>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <code>{p.url}</code>
              <dl>
                <dt>Approved origin</dt>
                <dd>{p.origin}</dd>
                <dt>Version history</dt>
                <dd>{p.versions.join(" → ")}</dd>
                <dt>Reviewed scenarios</dt>
                <dd>
                  {p.scenarios.length
                    ? p.scenarios.map(pretty).join(" / ")
                    : "No executable tools registered"}
                </dd>
              </dl>
            </div>
            <div className="product-actions">
              {p.id === "atelier" ? (
                <>
                  <a
                    className="button"
                    href="/demo/A"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open baseline A <ArrowUpRight size={15} />
                  </a>
                  <a
                    className="button"
                    href="/demo/B"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open candidate B <ArrowUpRight size={15} />
                  </a>
                  <Link to="compare">
                    Compare releases <ArrowRight size={15} />
                  </Link>
                </>
              ) : (
                <span className="mono">METADATA REGISTERED</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Evidence({
  experiment: e,
  backend,
}: {
  experiment?: Experiment;
  backend: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [shot, setShot] = useState(0);
  useEffect(() => {
    setIndex(0);
    setShot(0);
  }, [e?.id]);
  const r = e?.results[index];
  if (!r)
    return (
      <Empty
        title="Evidence follows execution."
        detail="Run an experiment to collect screenshots, Playwright traces, database observations, and exact assertions."
      />
    );
  return (
    <div className="evidence-layout">
      <aside>
        {e?.results.map((result, i) => (
          <button
            key={result.id}
            className={"evidence-item " + (i === index ? "selected" : "")}
            onClick={() => {
              setIndex(i);
              setShot(0);
            }}
          >
            <span className="mono">RELEASE {result.release}</span>
            <strong>{pretty(result.scenario)}</strong>
            <Status value={result.status} />
          </button>
        ))}
      </aside>
      <section>
        <div className="section-heading">
          <span className="mono">{r.id}</span>
          <Status value={r.status} />
        </div>
        <h2>{pretty(r.scenario)}</h2>
        <p className="reading">{r.assertion || r.error}</p>
        {r.screenshots[shot] && (
          <CaptureImage
            className="evidence-image"
            src={r.screenshots[shot]}
            alt={`Actual release ${r.release} browser evidence`}
            available={backend}
          />
        )}
        <p className="mono">
          CAPTURED SCREENSHOT /{" "}
          {backend
            ? "LOCAL ARTIFACT"
            : "BINARY ARTIFACTS REQUIRE THE LOCAL BACKEND"}
        </p>
        <div className="button-group">
          {r.screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => setShot(i)}
              className={shot === i ? "selected" : ""}
            >
              {i === 0 ? "Before" : "After"}
            </button>
          ))}
          {r.trace && (
            <a className="button" href={r.trace}>
              <Download size={14} />
              Download trace
            </a>
          )}
        </div>
        <details>
          <summary>Open the trace locally</summary>
          <p>Download the ZIP. In the repository, run:</p>
          <code>
            .venv\Scripts\python -m playwright show-trace path\to\trace.zip
          </code>
          <p>
            Playwright’s local viewer includes recorded DOM snapshots and action
            history. This captured evidence does not execute a new test.
          </p>
        </details>
        <h3>Deterministic observations</h3>
        <pre>{JSON.stringify(r.evidence, null, 2)}</pre>
        <h3>Reproduction notebook</h3>
        <ol>
          {r.reproduction?.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <details>
          <summary>
            Console & network records ({r.console.length + r.network.length})
          </summary>
          <pre>
            {JSON.stringify(
              { console: r.console, network: r.network },
              null,
              2,
            )}
          </pre>
        </details>
        <p className="mono">
          {r.duration_ms} MS /{" "}
          {r.status === "error"
            ? "EXECUTION ERROR — NOT A VERIFIED REGRESSION"
            : "ASSERTED BY REVIEWED PYTHON TOOLS"}
        </p>
      </section>
    </div>
  );
}

function Comparison({
  experiment: e,
  backend,
}: {
  experiment?: Experiment;
  backend: boolean;
}) {
  const [scenario, setScenario] = useState("rapid_checkout");
  const [view, setView] = useState("side");
  const [overlay, setOverlay] = useState(50);
  const a = e?.results.find(
      (r) => r.release === "A" && r.scenario === scenario,
    ),
    b = e?.results.find((r) => r.release === "B" && r.scenario === scenario);
  if (!e?.results.length)
    return (
      <Empty
        title="Two releases. One shared question."
        detail="Complete an experiment to compare actual stored baseline and candidate results."
      />
    );
  const regressions = e.results.filter(
    (r) =>
      r.release === "B" &&
      r.status === "failed" &&
      e.results.find((x) => x.release === "A" && x.scenario === r.scenario)
        ?.passed,
  );
  return (
    <>
      <div className="compare-toolbar">
        <label>
          Shared scenario
          <select
            value={scenario}
            onChange={(v) => setScenario(v.target.value)}
          >
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {pretty(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="button-group">
          <button
            className={view === "side" ? "selected" : ""}
            onClick={() => setView("side")}
          >
            Side by side
          </button>
          <button
            className={view === "diff" ? "selected" : ""}
            onClick={() => setView("diff")}
          >
            Pixel difference
          </button>
        </div>
        <span className="mono">
          {regressions.length} NEW VERIFIED REGRESSIONS
        </span>
      </div>
      {!a || !b ? (
        <Empty
          title="Shared evidence is incomplete."
          detail="This scenario needs a result from both releases."
        />
      ) : view === "side" ? (
        <div className="comparison-grid">
          {[a, b].map((r) => (
            <article key={r.release}>
              <div className="section-heading">
                <span className="eyebrow">
                  {r.release === "A"
                    ? "ORIGINAL / BASELINE"
                    : "EXPERIMENTAL / CANDIDATE"}{" "}
                  {r.release}
                </span>
                <Status value={r.status} />
              </div>
              <CaptureImage
                src={r.screenshots.at(-1)}
                alt={`Release ${r.release} actual final screenshot`}
                available={backend}
              />
              <h3>{r.assertion || r.error}</h3>
              <dl>
                <dt>Database orders</dt>
                <dd>{String(r.evidence.database_count ?? "Not measured")}</dd>
                <dt>Duration</dt>
                <dd>{r.duration_ms} ms</dd>
                <dt>Order total</dt>
                <dd>
                  {JSON.stringify(
                    (
                      r.evidence.database_orders as
                        { total_cents: number }[] | undefined
                    )?.map((o) => o.total_cents),
                  ) || "Not measured"}{" "}
                  cents
                </dd>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <>
          <p className="small-reading">
            Difference blend over actual screenshots. Session-specific order IDs
            and timing can create harmless pixel changes; this is not a defect
            classifier.
          </p>
          <label>
            Difference opacity{" "}
            <input
              type="range"
              min="0"
              max="100"
              value={overlay}
              onChange={(v) => setOverlay(+v.target.value)}
            />
          </label>
          {backend ? (
            <div className="difference">
              <img src={a.screenshots.at(-1)} alt="Baseline capture" />
              <img
                src={b.screenshots.at(-1)}
                alt="Candidate difference blend"
                style={{ opacity: overlay / 100 }}
              />
            </div>
          ) : (
            <Empty
              title="Pixel evidence stays in the local archive."
              detail="Reconnect the backend to load the original screenshots. Report metadata remains available."
            />
          )}
        </>
      )}
      <div className="compare-conclusion">
        <span className="italic">What changed?</span>
        <p>
          {b?.status === "failed" && a?.passed
            ? "The candidate violates an assertion that passed on the baseline. Inspect the evidence before making a release decision."
            : b?.status === "error" || a?.status === "error"
              ? "An execution error prevents a verified comparison."
              : "Read the recorded assertion outcomes. Matching results establish only the tested condition."}
        </p>
        <Link to="evidence">
          Inspect evidence
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}

function Atlas({ backend }: { backend: boolean }) {
  const [data, setData] = useState<{
    nodes: { id: string; label: string; kind: string }[];
    edges: { source: string; target: string; provenance: string }[];
  }>();
  const [focus, setFocus] = useState("checkout");
  useEffect(() => {
    if (backend)
      void request<typeof data>("/graph").then((d) => {
        if (d) {
          setData(d);
          void cache("graph", d);
        }
      });
    else void cached<typeof data>("graph").then(setData);
  }, [backend]);
  if (!data)
    return (
      <Empty
        title="Registered dependencies appear here."
        detail="Connect the backend to load the verified fixture graph."
      />
    );
  const affected = new Set([focus]);
  for (let i = 0; i < data.nodes.length; i++)
    for (const edge of data.edges)
      if (affected.has(edge.source)) affected.add(edge.target);
  const counts: Record<string, number> = {};
  const columns: Record<string, number> = {
    screen: 0,
    feature: 1,
    operation: 2,
    scenario: 3,
    failure: 4,
  };
  const nodes: Node[] = data.nodes.map((n) => {
    const y = counts[n.kind] || 0;
    counts[n.kind] = y + 1;
    return {
      id: n.id,
      data: { label: n.label },
      position: { x: columns[n.kind] * 230, y: y * 100 },
      style: {
        background: affected.has(n.id) ? "#ece0d8" : "#f5f1e8",
        color: "#181818",
        border: "1px solid " + (n.kind === "failure" ? "#762e3a" : "#aaa092"),
        fontFamily: "monospace",
        fontSize: 12,
        width: 190,
      },
    };
  });
  const edges: Edge[] = data.edges.map((e, i) => ({
    id: String(i),
    source: e.source,
    target: e.target,
    label: e.provenance.startsWith("stored") ? "observed" : "registered",
    style: { stroke: affected.has(e.source) ? "#762e3a" : "#c8beb0" },
  }));
  return (
    <>
      <div className="toolbar">
        <label>
          Changed feature
          <select value={focus} onChange={(e) => setFocus(e.target.value)}>
            {data.nodes
              .filter((n) => n.kind !== "failure")
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
          </select>
        </label>
        <span className="mono">
          {affected.size} RELATED NODES / REGISTERED + OBSERVED EDGES
        </span>
      </div>
      <div className="graph">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          onNodeClick={(_, node) => setFocus(node.id)}
        >
          <Background color="#d8d0c3" gap={24} />
          <Controls />
        </ReactFlow>
      </div>
      <p className="small-reading">
        Highlight follows directed dependencies. Registry edges describe the
        demo implementation; failure edges refer to persisted assertions. This
        is not inferred code coverage.
      </p>
    </>
  );
}

function Risk({
  experiment: e,
  experiments,
}: {
  experiment?: Experiment;
  experiments: Experiment[];
}) {
  const rows = SCENARIOS.map((s) => {
    const results = experiments.flatMap((j) =>
      j.status === "completed" ? j.results.filter((r) => r.scenario === s) : [],
    );
    return {
      name: pretty(s),
      failed: results.filter((r) => r.status === "failed").length,
      passed: results.filter((r) => r.passed).length,
    };
  });
  const [ranking, setRanking] = useState<
    { scenario: string; score: number; reason: string }[]
  >([]);
  useEffect(() => {
    void request<{ ranking: typeof ranking }>("/risk")
      .then((r) => {
        setRanking(r.ranking);
        void cache("ranking", r.ranking);
      })
      .catch(
        () =>
          void cached<typeof ranking>("ranking").then((r) =>
            setRanking(r || []),
          ),
      );
  }, []);
  return (
    <>
      <div className="risk-summary">
        <span className="eyebrow">CURRENT RELEASE ASSESSMENT</span>
        <h2>{e?.risk?.verdict || "Awaiting evidence"}</h2>
        <p className="reading">
          {e?.risk?.reason ||
            "Run the signature experiment to assess the candidate release."}
        </p>
        <span className="tag">DETERMINISTIC FALLBACK</span>
        <p>
          {e?.risk?.limitations ||
            "No predictive accuracy is claimed. A trained risk probability requires sufficient independent real release histories and validated pre-release features."}
        </p>
      </div>
      <div className="two-columns">
        <section>
          <span className="eyebrow">OBSERVED ASSERTION HISTORY / COUNTS</span>
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={rows}
                margin={{ top: 25, right: 10, bottom: 55, left: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#d8d0c3" />
                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  tick={{ fontSize: 11, fontFamily: "monospace" }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fontFamily: "monospace" }}
                />
                <Tooltip />
                <Bar dataKey="passed" fill="#596B54" name="Verified pass" />
                <Bar dataKey="failed" fill="#762E3A" name="Assertion failure" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="small-reading">
            Observed counts across completed experiments. Repeated runs of two
            demo releases are not independent production training data.
          </p>
        </section>
        <section>
          <span className="eyebrow">WHICH QUESTION NEXT?</span>
          {ranking.map((r, i) => (
            <div className="rank-row" key={r.scenario}>
              <span className="editorial-number">{i + 1}</span>
              <div>
                <h3>{pretty(r.scenario)}</h3>
                <p>{r.reason}</p>
              </div>
              <code>{r.score}</code>
            </div>
          ))}
          <p className="mono">
            INTERPRETABLE PRIORITY RULE / NOT A LEARNED RANKER
          </p>
        </section>
      </div>
      <div className="two-columns">
        <section className="note-panel">
          <h3>Regression risk model</h3>
          <p>
            A Random Forest training pipeline is included. It holds out entire
            release families, rejects insufficient data, and reports precision,
            recall, F1, and balanced accuracy. Synthetic training is explicitly
            labeled and stored separately.
          </p>
          <code>python -m scripts.train history.csv</code>
        </section>
        <section className="note-panel">
          <h3>Behavioral anomalies</h3>
          <p>
            {e?.anomalies?.reason ||
              "Isolation Forest requires at least 20 prior observations. An unusual execution does not establish a software defect."}
          </p>
          {e?.anomalies?.available && (
            <p className="mono">
              {e.anomalies.flags?.filter(Boolean).length || 0} UNUSUAL CURRENT
              EXECUTIONS
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Journal({
  experiment: e,
  backend,
  notice,
}: {
  experiment?: Experiment;
  backend: boolean;
  notice: (s: string) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!e) return;
    let active = true;
    setNote("");
    void (async () => {
      const draft = await cached<{ text: string }>("draft:note:" + e.id);
      const saved = await cached<{ text: string }>("note:" + e.id);
      if (active) setNote(draft?.text ?? saved?.text ?? "");
      if (backend) {
        try {
          const remote = await request<{ text: string; revision: number }>(
            "/notes/" + e.id,
          );
          await cache("note:" + e.id, remote);
          if (active && !draft) setNote(remote.text);
        } catch {
          /* Keep the local draft if the backend disconnects. */
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [e?.id, backend]);
  if (!e)
    return (
      <Empty
        title="The first page is unwritten."
        detail="Complete an investigation to generate a report from real browser evidence."
      />
    );
  return (
    <article className="journal">
      <div className="journal-margin">
        <span className="eyebrow">FINDINGS / {e.id}</span>
        <span className="editorial-number">{date(e.created)}</span>
        <Status value={e.status} />
        <p className="mono">
          {e.mode === "ai"
            ? "OLLAMA INVESTIGATION"
            : "MANUAL DETERMINISTIC MODE"}
        </p>
      </div>
      <div className="journal-body">
        <span className="eyebrow">
          ATELIER COMMERCE / RELEASE A + RELEASE B
        </span>
        <h2>{e.title}</h2>
        <p className="journal-deck italic">
          A release is a hypothesis.
          <br />
          Evidence is how we answer.
        </p>
        <h3>The question</h3>
        <p>{e.objective}</p>
        <h3>Exact test environment</h3>
        <pre>
          {JSON.stringify(e.environment || { status: "not executed" }, null, 2)}
        </pre>
        <h3>What was observed</h3>
        {e.results.map((r) => (
          <div className="report-finding" key={r.id}>
            <Status value={r.status} />
            <h4>
              {r.release} / {pretty(r.scenario)}
            </h4>
            <p>{r.assertion || r.error}</p>
            <code>{r.id}</code>
            <details>
              <summary>Evidence & reproduction</summary>
              <pre>{JSON.stringify(r.evidence, null, 2)}</pre>
              <ol>
                {r.reproduction?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <a href={r.trace}>Playwright trace ZIP</a>
            </details>
          </div>
        ))}
        <h3>Readiness verdict</h3>
        <blockquote>{e.risk?.verdict || "Investigation incomplete"}</blockquote>
        <p>{e.risk?.reason}</p>
        <p>{e.risk?.limitations}</p>
        <h3>Local AI explanations</h3>
        {e.agents.length ? (
          e.agents.map((a, i) => (
            <section key={i}>
              <h4>
                {a.role} <span className="mono">/ {a.source}</span>
              </h4>
              <p>{a.summary || a.error}</p>
              <p className="small-reading">
                Uncertainty:{" "}
                {a.uncertainty || "No valid inference was produced."}
              </p>
            </section>
          ))
        ) : (
          <p>
            No AI reasoning was used. Assertions and the release verdict were
            produced by deterministic tools.
          </p>
        )}
        <h3>Unresolved uncertainties</h3>
        <p>
          This bounded fixture experiment does not establish production
          readiness. Visual differences can contain changing order identifiers.
          Personas are interaction constraints, not verified models of customer
          behavior. Machine-learning training needs independent release history.
        </p>
        <div className="notebook">
          <label>
            Engineer’s notes
            <textarea
              value={note}
              maxLength={10000}
              onChange={(v) => {
                setNote(v.target.value);
                void cache("draft:note:" + e.id, { text: v.target.value });
              }}
              placeholder="A question for the next investigation…"
            />
          </label>
          <button
            onClick={async () => {
              try {
                await saveNote(e.id, note);
                notice(
                  "Note saved locally. Safe metadata sync runs when the backend is available.",
                );
              } catch (error) {
                notice(String(error));
              }
            }}
          >
            Save note <Check size={14} />
          </button>
          <p className="mono">PERSISTENT LOCAL DRAFT / IDEMPOTENT SYNC</p>
        </div>
      </div>
    </article>
  );
}

function Services({
  health: h,
  backend,
  online,
  pending,
  refresh,
}: {
  health?: Health;
  backend: boolean;
  online: boolean;
  pending: number;
  refresh: () => Promise<void>;
}) {
  const [sw, setSw] = useState(false);
  const [usage, setUsage] = useState(0);
  const [cacheCount, setCacheCount] = useState(0);
  const [conflicts, setConflicts] = useState<
    { key: string; note: string; text: string; server?: unknown }[]
  >([]);
  useEffect(() => {
    void navigator.serviceWorker
      ?.getRegistration()
      .then((r) => setSw(!!r?.active));
    void navigator.storage?.estimate().then((e) => setUsage(e.usage || 0));
    void local.cache.count().then(setCacheCount);
    void local.operations
      .where("state")
      .equals("conflict")
      .toArray()
      .then(setConflicts);
  }, [pending]);
  const rows = [
    [
      "Internet connectivity",
      online ? "Reported available" : "Reported unavailable",
      "navigator.onLine is a browser connectivity signal; local services are probed independently.",
    ],
    [
      "Local backend",
      backend ? "Available" : "Disconnected",
      "FastAPI / SQLite / controlled loopback origin.",
    ],
    [
      "Ollama inference",
      backend && h?.ollama.service ? "Available" : "Unavailable",
      h?.ollama.model || "qwen3.5:4b",
    ],
    [
      "Selected AI model",
      backend && h?.ollama.available ? "Installed" : "Unavailable",
      h?.ollama.installed.join(", ") ||
        "Deterministic manual mode remains available.",
    ],
    [
      "Background worker",
      backend && h?.worker ? "Running" : "Unavailable",
      `${h?.active || 0} active / ${h?.queued || 0} queued. One browser at a time.`,
    ],
    [
      "SQLite integrity",
      backend && h?.database ? "Verified" : "Not checked",
      "PRAGMA quick_check, migrations, WAL journaling.",
    ],
    [
      "Service worker",
      sw ? "Active" : "Not active",
      "Available after a production build on localhost.",
    ],
    [
      "Offline metadata cache",
      `${cacheCount} entries`,
      "20 MB explicit metadata limit. No automatic screenshot or trace binary caching.",
    ],
    [
      "Browser storage",
      bytes(usage),
      "Origin storage estimate, including Cache Storage and IndexedDB.",
    ],
    [
      "Local backend storage",
      backend ? bytes(h?.storage_bytes || 0) : "Unknown",
      `Artifacts ${bytes(h?.artifact_bytes || 0)}. Kept on disk; excluded from Git.`,
    ],
    [
      "Pending metadata sync",
      String(pending),
      "Only safe note edits retry. Experiment execution requires an explicit Begin action.",
    ],
  ];
  return (
    <>
      <div className="service-banner">
        <span className="italic">
          Your machine.
          <br />
          Your evidence.
        </span>
        <div>
          <span className="eyebrow">
            {backend
              ? "LOCAL LABORATORY — ACTIVE"
              : "BACKEND DISCONNECTED — ARCHIVE MODE"}
          </span>
          <p>
            Python keeps experiments running while this tab is closed. Keep the
            backend process alive.
          </p>
          <button onClick={() => void refresh()}>
            Run diagnostics
            <Activity size={15} />
          </button>
        </div>
      </div>
      <div className="service-table">
        {rows.map(([label, value, explanation]) => (
          <div key={label}>
            <h3>{label}</h3>
            <strong className="mono">{value}</strong>
            <p>{explanation}</p>
          </div>
        ))}
      </div>
      {conflicts.length > 0 && (
        <section>
          <h3>Conflicting note edits need review</h3>
          {conflicts.map((op) => (
            <div className="note-panel" key={op.key}>
              <p>{op.note}</p>
              <pre>{op.text}</pre>
              <details>
                <summary>Server revision</summary>
                <pre>{JSON.stringify(op.server, null, 2)}</pre>
              </details>
              <button
                onClick={async () => {
                  await cache("draft:conflict:" + op.key, {
                    text: op.text,
                    server: op.server,
                  });
                  await local.operations.delete(op.key);
                  setConflicts((c) => c.filter((x) => x.key !== op.key));
                }}
              >
                Keep both as local draft
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="offline-guide">
        <h3>Three conditions, clearly separated.</h3>
        <p>
          <strong>Internet unavailable:</strong> localhost tests and Ollama
          remain operational. <strong>Backend disconnected:</strong> cached
          findings, product metadata, and drafts remain readable.{" "}
          <strong>Ollama unavailable:</strong> choose deterministic manual mode.
        </p>
        <p>
          The service worker serves the interface. It does not execute Python,
          browsers, or AI. Trace binaries remain in controlled backend storage.
        </p>
      </div>
    </>
  );
}
