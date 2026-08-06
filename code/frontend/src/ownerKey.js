// A "user" login and an "admin" login (or two different names) each get their
// own bucket wherever the backend scopes something by owner — chat sessions
// (Chat.jsx) and, now, hosted agents this console deployed (Agents.jsx).
export function ownerKeyFor(session) {
  if (!session?.name) return ''
  return `${session.name.trim().toLowerCase()}::${session.role || 'user'}`
}
