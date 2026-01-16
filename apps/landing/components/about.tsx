"use client"

import { Info, CheckCircle2, Circle, Clock } from "lucide-react"

interface FeatureItem {
  name: string
  status: "done" | "in_progress" | "planned"
  description?: string
}

export function About() {
  const protocolFeatures: FeatureItem[] = [
    { name: "ZMSG v4 Protocol", status: "done", description: "Conversation ID-based threading" },
    { name: "Private 1:1 Messaging", status: "done", description: "End-to-end encrypted via shielded transactions" },
    { name: "Message Chunking", status: "done", description: "Split large messages across multiple memos" },
    { name: "Contact Management", status: "done", description: "Save, nickname, and organize contacts" },
    { name: "Conversation History", status: "done", description: "Persistent chat history with threading" },
    { name: "ZEC Payments", status: "done", description: "Send payments with messages" },
    { name: "Read Receipts (ZRCPT)", status: "done", description: "Optional delivery confirmations" },
    { name: "Message Reactions (ZREACT)", status: "done", description: "React to messages with emoji" },
    { name: "Reply to Message (RPL)", status: "done", description: "Quote and reply to specific messages" },
    { name: "User Status (ZSTAT)", status: "done", description: "Set availability status" },
    { name: "Payment Requests (ZREQ)", status: "done", description: "Request ZEC from contacts" },
    { name: "Time-Locked Messages (ZTL)", status: "done", description: "Schedule, block-height, and conditional reveals" },
  ]

  const groupFeatures: FeatureItem[] = [
    { name: "ZMSG-GROUP Protocol", status: "in_progress", description: "Group messaging specification" },
    { name: "Group Creation", status: "in_progress", description: "Create named groups with members" },
    { name: "Group Invitations", status: "in_progress", description: "Invite users to join groups" },
    { name: "Group Messaging", status: "in_progress", description: "AES-256-GCM encrypted group chat" },
    { name: "Leave Group", status: "in_progress", description: "Exit groups with notification" },
    { name: "Group Settings", status: "in_progress", description: "View members and group info" },
    { name: "Key Rotation", status: "planned", description: "Rotate encryption keys when members leave" },
    { name: "Admin Controls", status: "planned", description: "Kick members, transfer ownership" },
  ]

  const futureFeatures: FeatureItem[] = [
    { name: "Encrypted Attachments", status: "planned", description: "Images and audio files" },
    { name: "Voice Messages", status: "planned", description: "Encrypted voice recordings" },
    { name: "iOS App", status: "planned", description: "Native iOS client" },
    { name: "Desktop App", status: "planned", description: "macOS, Windows, Linux" },
    { name: "Private Calls", status: "planned", description: "Zcash-anchored live calls" },
  ]

  const StatusIcon = ({ status }: { status: FeatureItem["status"] }) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-5 w-5 text-green-400" />
      case "in_progress":
        return <Clock className="h-5 w-5 text-yellow-400" />
      case "planned":
        return <Circle className="h-5 w-5 text-gray-500" />
    }
  }

  const FeatureList = ({ items, title }: { items: FeatureItem[]; title: string }) => (
    <div className="mb-8">
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
          >
            <StatusIcon status={item.status} />
            <div className="flex-1">
              <span className="font-medium text-white">{item.name}</span>
              {item.description && (
                <p className="mt-0.5 text-sm text-gray-400">{item.description}</p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                item.status === "done"
                  ? "bg-green-500/20 text-green-400"
                  : item.status === "in_progress"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {item.status === "done" ? "Done" : item.status === "in_progress" ? "In Progress" : "Planned"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <section id="about" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-12 flex items-center justify-center gap-3">
            <Info className="h-6 w-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white lg:text-3xl">About ZCHAT</h2>
          </div>

          {/* Introduction */}
          <div className="mb-12 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-center">
            <p className="text-lg leading-relaxed text-gray-300">
              ZCHAT is a privacy-first encrypted messenger that sends chat messages as shielded Zcash
              transactions. Every message is end-to-end encrypted with zero metadata exposure. Built
              for the Zypherpunk Hackathon 2024-2025.
            </p>
          </div>

          {/* Demo Video */}
          <div className="mb-12">
            <h3 className="mb-4 text-center text-lg font-semibold text-white">Demo Video</h3>
            <div className="relative aspect-video overflow-hidden rounded-xl border border-cyan-500/20">
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/PL5YmT24Heg"
                title="ZCHAT Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* Feature Status Legend */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-gray-300">Implemented</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span className="text-gray-300">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-gray-500" />
              <span className="text-gray-300">Planned</span>
            </div>
          </div>

          {/* Feature Lists */}
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <FeatureList items={protocolFeatures} title="Core Protocol Features" />
            </div>
            <div>
              <FeatureList items={groupFeatures} title="Group Messaging (Sprint 4)" />
              <FeatureList items={futureFeatures} title="Future Features" />
            </div>
          </div>

          {/* Protocol Link */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400">
              Full protocol specification available in the{" "}
              <a
                href="https://github.com/yourt/zchat-android"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                source code repository
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
