import analyze from "./analyze.js";

export function createAiHandler() {
  const retryAt = new Map();

  return async function handleAi(req, res) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Only POST requests are allowed." });
    }
    const providers = [
      {
        id: "openrouter",
        key: process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KE,
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3.5-super-vl:free",
      },
      {
        id: "groq",
        key: process.env.GROQ_API_KEY,
        url: "https://api.groq.com/openai/v1/chat/completions",
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      },
    ].filter(provider => provider.key);
    if (!providers.length) {
      return res.status(500).json({ error: "The AI service is not configured. Please contact the site owner." });
    }
    const active = providers.filter(provider => (retryAt.get(provider.id) || 0) <= Date.now());
    if (!active.length) {
      const seconds = Math.max(1, Math.ceil((Math.min(...providers.map(provider => retryAt.get(provider.id))) - Date.now()) / 1000));
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({ error: `AI is busy. Wait ${seconds} seconds, then try again.` });
    }

    const controllers = active.map(() => new AbortController());
    const tasks = active.map((provider, index) => new Promise((resolve, reject) => {
      const headers = {};
      // Each provider writes here first. Only a fully validated result reaches React.
      const output = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        setHeader(name, value) { headers[name] = value; },
        json(data) {
          if (this.statusCode === 200) return resolve(data);
          if (this.statusCode === 429) {
            retryAt.set(provider.id, Date.now() + (Number(headers["Retry-After"]) || 60) * 1000);
          }
          reject({ status: this.statusCode, data });
        },
      };
      analyze(req, output, { ...provider, signal: controllers[index].signal }).catch(() => {
        reject({ status: 502, data: { error: "AI could not complete the analysis. Please try again." } });
      });
    }));

    try {
      const data = await Promise.any(tasks);
      return res.status(200).json(data);
    } catch (error) {
      const failures = error.errors || [];
      const invalid = failures.find(item => item.status === 400);
      if (invalid) return res.status(400).json(invalid.data);
      const seconds = Math.max(0, Math.ceil((Math.min(...providers.map(provider => retryAt.get(provider.id) || 0)) - Date.now()) / 1000));
      if (seconds > 0) {
        res.setHeader("Retry-After", String(seconds));
        return res.status(429).json({ error: `AI is busy. Wait ${seconds} seconds, then try again.` });
      }
      const failure = failures.find(item => item.status !== 429) || failures[0];
      return res.status(failure?.status || 502).json(failure?.data || { error: "AI could not complete the analysis. Please try again." });
    } finally {
      controllers.forEach(controller => controller.abort());
    }
  };
}
