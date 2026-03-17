const API_BASE = "https://api.elevenlabs.io/v1"

function getHeaders() {
  return {
    "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    "Content-Type": "application/json",
  }
}

export async function getSignedUrl(): Promise<string> {
  const agentId = process.env.ELEVENLABS_AGENT_ID!
  const res = await fetch(
    `${API_BASE}/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: getHeaders() },
  )
  if (!res.ok) {
    throw new Error(`Failed to get signed URL: ${res.status}`)
  }
  const data = await res.json()
  return data.signed_url
}

export async function getScribeToken(): Promise<string> {
  const res = await fetch(
    `${API_BASE}/single-use-token/realtime_scribe`,
    { method: "POST", headers: getHeaders() },
  )
  if (!res.ok) {
    throw new Error(`Failed to get Scribe token: ${res.status}`)
  }
  const data = await res.json()
  return data.token
}

export async function getConversationToken(): Promise<string> {
  const agentId = process.env.ELEVENLABS_AGENT_ID!
  const res = await fetch(
    `${API_BASE}/convai/conversation/token?agent_id=${agentId}`,
    { headers: getHeaders() },
  )
  if (!res.ok) {
    throw new Error(`Failed to get conversation token: ${res.status}`)
  }
  const data = await res.json()
  return data.token
}
