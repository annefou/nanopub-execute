const fetch = require("node-fetch");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { uri, author, description } = JSON.parse(event.body || "{}");
  if (!uri || !uri.startsWith("http")) {
    return { statusCode: 400, body: "Invalid URI" };
  }

  const filename = `submissions/${Date.now()}.json`;
  const content = JSON.stringify({ uri, author, description }, null, 2);

  const token = process.env.GITHUB_PAT;
  const repo = "annefou/nanopub-execute";

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: `Add submission for ${uri}`,
      content: Buffer.from(content).toString("base64"),
      branch: "main"
    })
  });

  const json = await res.json();
  if (!res.ok) {
    return { statusCode: res.status, body: JSON.stringify(json) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, link: json.content.html_url }),
  };
};

