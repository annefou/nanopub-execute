const fetch = require("node-fetch");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { uri, author, description } = JSON.parse(event.body || "{}");
  if (!uri || !uri.startsWith("http")) {
    return { statusCode: 400, body: "Invalid URI" };
  }

  const timestamp = Date.now();
  const branchName = `submission-${timestamp}`;
  const filename = `submissions/${timestamp}.json`;
  const content = JSON.stringify({ uri, author, description }, null, 2);

  const token = process.env.GITHUB_PAT;
  const repo = "annefou/nanopub-execute";

  // Step 1: Create a new branch
  const createBranchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: await getMainBranchSHA(token, repo),
    }),
  });

  const createBranchJson = await createBranchRes.json();
  console.log("GitHub API Response (create branch):", createBranchJson);  // Debugging line

  if (!createBranchRes.ok) {
    return { statusCode: createBranchRes.status, body: JSON.stringify(createBranchJson) };
  }

  // Step 2: Upload the file to the new branch
  const uploadFileRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filename}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: `Add submission for ${uri}`,
      content: Buffer.from(content).toString("base64"),
      branch: branchName,
    })
  });

  const uploadFileJson = await uploadFileRes.json();
  console.log("GitHub API Response (file upload):", uploadFileJson);  // Debugging line

  if (!uploadFileRes.ok) {
    return { statusCode: uploadFileRes.status, body: JSON.stringify(uploadFileJson) };
  }

  // Step 3: Create a PR from the new branch to the main branch
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      title: `Add submission for ${uri}`,
      head: branchName,  // The new branch
      base: "main",  // The main branch you want to merge into
      body: `This PR adds a submission for ${uri} by ${author}.`,
    }),
  });

  const prJson = await prRes.json();
  console.log("GitHub API Response (PR creation):", prJson);  // Debugging line

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

// Helper function to get the SHA of the main branch
async function getMainBranchSHA(token, repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/main`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nanopub-submitter",
      Accept: "application/vnd.github.v3+json",
    },
  });

  const json = await res.json();
  return json.object.sha;  // Return the SHA of the main branch
}

