"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Lock, LogIn, Users, Mail, Key, Check, X, Clock, Send, RefreshCw } from "lucide-react"

interface WhitelistEntry {
  id: number
  email: string
  reason: string
  status: string
  createdAt: string
  approvedAt: string | null
  downloadCodes: {
    id: number
    code: string
    used: boolean
    usedAt: string | null
    createdAt: string
    expiresAt: string
  }[]
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [adminSecret, setAdminSecret] = useState("")
  const [inputSecret, setInputSecret] = useState("")
  const [loginError, setLoginError] = useState("")
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WhitelistEntry | null>(null)
  const [generating, setGenerating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Check for existing session
  useEffect(() => {
    const stored = localStorage.getItem("zchat_admin_secret")
    if (stored) {
      setAdminSecret(stored)
      setIsLoggedIn(true)
    }
  }, [])

  // Load entries when logged in
  useEffect(() => {
    if (isLoggedIn && adminSecret) {
      loadEntries()
    }
  }, [isLoggedIn, adminSecret])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")

    try {
      // Test the secret by making a request
      const response = await fetch("https://api.zsend.xyz/admin/whitelist", {
        headers: {
          "X-Admin-Secret": inputSecret,
        },
      })

      if (response.ok) {
        localStorage.setItem("zchat_admin_secret", inputSecret)
        setAdminSecret(inputSecret)
        setIsLoggedIn(true)
      } else {
        setLoginError("Invalid admin secret")
      }
    } catch {
      setLoginError("Failed to connect to server")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("zchat_admin_secret")
    setAdminSecret("")
    setIsLoggedIn(false)
    setEntries([])
  }

  const loadEntries = async () => {
    setLoading(true)
    try {
      const response = await fetch("https://api.zsend.xyz/admin/whitelist", {
        headers: {
          "X-Admin-Secret": adminSecret,
        },
      })
      const data = await response.json()
      if (data.entries) {
        setEntries(data.entries)
      }
    } catch (error) {
      console.error("Failed to load entries:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateCode = async (entry: WhitelistEntry) => {
    setGenerating(true)
    setMessage(null)
    try {
      const response = await fetch(`https://api.zsend.xyz/admin/whitelist/${entry.id}/generate-code`, {
        method: "POST",
        headers: {
          "X-Admin-Secret": adminSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (data.success) {
        setMessage({ type: "success", text: `Code generated: ${data.code}` })
        loadEntries() // Refresh the list
      } else {
        setMessage({ type: "error", text: data.error || "Failed to generate code" })
      }
    } catch {
      setMessage({ type: "error", text: "Failed to generate code" })
    } finally {
      setGenerating(false)
    }
  }

  const sendCodeEmail = async (entry: WhitelistEntry, code: string) => {
    setSendingEmail(true)
    setMessage(null)
    try {
      const response = await fetch(`https://api.zsend.xyz/admin/whitelist/${entry.id}/send-code-email`, {
        method: "POST",
        headers: {
          "X-Admin-Secret": adminSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      })
      const data = await response.json()
      if (data.success) {
        setMessage({ type: "success", text: `Email sent to ${entry.email}` })
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send email" })
      }
    } catch {
      setMessage({ type: "error", text: "Failed to send email" })
    } finally {
      setSendingEmail(false)
    }
  }

  const generateAndSendCode = async (entry: WhitelistEntry) => {
    setGenerating(true)
    setSendingEmail(true)
    setMessage(null)
    try {
      // First generate the code
      const genResponse = await fetch(`https://api.zsend.xyz/admin/whitelist/${entry.id}/generate-code`, {
        method: "POST",
        headers: {
          "X-Admin-Secret": adminSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
      const genData = await genResponse.json()

      if (!genData.success) {
        setMessage({ type: "error", text: genData.error || "Failed to generate code" })
        return
      }

      // Then send the email
      const emailResponse = await fetch(`https://api.zsend.xyz/admin/whitelist/${entry.id}/send-code-email`, {
        method: "POST",
        headers: {
          "X-Admin-Secret": adminSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: genData.code }),
      })
      const emailData = await emailResponse.json()

      if (emailData.success) {
        setMessage({ type: "success", text: `Code ${genData.code} generated and sent to ${entry.email}` })
        loadEntries()
      } else {
        setMessage({ type: "error", text: `Code generated (${genData.code}) but email failed: ${emailData.error}` })
        loadEntries()
      }
    } catch {
      setMessage({ type: "error", text: "Failed to generate and send code" })
    } finally {
      setGenerating(false)
      setSendingEmail(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-400 bg-green-500/10"
      case "rejected":
        return "text-red-400 bg-red-500/10"
      default:
        return "text-yellow-400 bg-yellow-500/10"
    }
  }

  // Login page
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#050510] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 mb-4">
              <Lock className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">ZCHAT Admin</h1>
            <p className="text-gray-400 mt-2">Enter your admin secret to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={inputSecret}
                onChange={(e) => setInputSecret(e.target.value)}
                placeholder="Admin Secret"
                className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <Button
              type="submit"
              className="w-full bg-cyan-500 text-black hover:bg-cyan-400"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          </form>
        </div>
      </main>
    )
  }

  // Admin Dashboard
  return (
    <main className="min-h-screen bg-[#050510]">
      {/* Header */}
      <header className="border-b border-cyan-500/20 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white">ZCHAT Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={loadEntries}
              variant="outline"
              size="sm"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-400 hover:bg-gray-800"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg ${
          message.type === "success" ? "bg-green-500/20 border border-green-500/50 text-green-400" : "bg-red-500/20 border border-red-500/50 text-red-400"
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-3 hover:opacity-70">×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/30 p-4">
            <p className="text-gray-400 text-sm">Total Requests</p>
            <p className="text-2xl font-bold text-white">{entries.length}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-gray-900/30 p-4">
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">
              {entries.filter((e) => e.status === "pending").length}
            </p>
          </div>
          <div className="rounded-xl border border-green-500/20 bg-gray-900/30 p-4">
            <p className="text-gray-400 text-sm">Approved</p>
            <p className="text-2xl font-bold text-green-400">
              {entries.filter((e) => e.status === "approved").length}
            </p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-gray-900/30 p-4">
            <p className="text-gray-400 text-sm">Downloaded</p>
            <p className="text-2xl font-bold text-cyan-400">
              {entries.filter((e) => e.downloadCodes.some((c) => c.used)).length}
            </p>
          </div>
        </div>

        {/* Entries Table */}
        <div className="rounded-xl border border-cyan-500/20 bg-gray-900/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cyan-500/20 bg-gray-900/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Codes</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-900/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-white text-sm">{entry.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-300 text-sm max-w-xs truncate" title={entry.reason}>
                        {entry.reason}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(entry.status)}`}>
                        {entry.status === "approved" && <Check className="w-3 h-3" />}
                        {entry.status === "rejected" && <X className="w-3 h-3" />}
                        {entry.status === "pending" && <Clock className="w-3 h-3" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-400 text-sm">{formatDate(entry.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4">
                      {entry.downloadCodes.length > 0 ? (
                        <div className="space-y-1">
                          {entry.downloadCodes.map((code) => (
                            <div key={code.id} className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-gray-800 px-2 py-1 rounded text-cyan-400">
                                {code.code}
                              </code>
                              {code.used ? (
                                <span className="text-xs text-green-400">Used</span>
                              ) : new Date() > new Date(code.expiresAt) ? (
                                <span className="text-xs text-red-400">Expired</span>
                              ) : (
                                <span className="text-xs text-yellow-400">Active</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No codes</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {entry.status === "pending" && (
                          <Button
                            onClick={() => generateAndSendCode(entry)}
                            size="sm"
                            className="bg-cyan-500 text-black hover:bg-cyan-400 text-xs"
                            disabled={generating || sendingEmail}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Approve & Send
                          </Button>
                        )}
                        {entry.status === "approved" && entry.downloadCodes.length > 0 && (
                          <>
                            {!entry.downloadCodes.some((c) => c.used) && (
                              <Button
                                onClick={() => sendCodeEmail(entry, entry.downloadCodes[0].code)}
                                size="sm"
                                variant="outline"
                                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                                disabled={sendingEmail}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                Resend Email
                              </Button>
                            )}
                            <Button
                              onClick={() => generateCode(entry)}
                              size="sm"
                              variant="outline"
                              className="border-gray-600 text-gray-400 hover:bg-gray-800 text-xs"
                              disabled={generating}
                            >
                              <Key className="w-3 h-3 mr-1" />
                              New Code
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No whitelist entries yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
