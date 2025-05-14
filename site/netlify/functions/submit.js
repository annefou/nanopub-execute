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

  // Upload file to GitHub
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
      branch: "main",
    })
  });

  const json = await res.json();
  if (!res.ok) {
    return { statusCode: res.status, body: JSON.stringify(json) };
  }

  // Create a pull request (if needed) - optional step to automatically create PR
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      title: `Add submission for ${uri}`,
      head: "main",  // The branch the file was pushed to
      base: "main",  // The branch you want to merge into
      body: `This PR adds a submission for ${uri} by ${author}.`,
    }),
  });

  const prJson = await prRes.json();
  if (!prRes.ok) {
    return { statusCode: prRes.status, body: JSON.stringify(prJson) };
  }

  // Return success and the PR link
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      pr_link: prJson.html_url, // PR URL
    }),
  };
};

