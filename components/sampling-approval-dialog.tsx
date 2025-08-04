'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface SamplingRequest {
  id: string
  serverName: string
  messages: Array<{
    role: string
    content: {
      type: string
      text: string
    }
  }>
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  modelPreferences?: {
    speedPriority?: number
    intelligencePriority?: number
    costPriority?: number
  }
}

interface SamplingApprovalDialogProps {
  request: SamplingRequest | null
  isOpen: boolean
  onApprove: (modifiedPrompt?: string) => void
  onDeny: () => void
  onClose: () => void
}

export function SamplingApprovalDialog({
  request,
  isOpen,
  onApprove,
  onDeny,
  onClose,
}: SamplingApprovalDialogProps) {
  const [modifiedPrompt, setModifiedPrompt] = useState('')
  const [showPromptEditor, setShowPromptEditor] = useState(false)

  if (!request) return null

  const handleApprove = () => {
    onApprove(showPromptEditor ? modifiedPrompt : undefined)
    setShowPromptEditor(false)
    setModifiedPrompt('')
  }

  const handleDeny = () => {
    onDeny()
    setShowPromptEditor(false)
  }

  const mainMessage = request.messages.find(m => m.role === 'user')?.content?.text || ''

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MCP Sampling Request</DialogTitle>
          <DialogDescription>
            The MCP server &quot;{request.serverName}&quot; wants to use AI to analyze content. 
            Review the request details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Server Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Server Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{request.serverName}</Badge>
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Request Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {request.maxTokens && (
                <div className="text-sm">
                  <span className="font-medium">Max Tokens:</span> {request.maxTokens}
                </div>
              )}
              {request.temperature !== undefined && (
                <div className="text-sm">
                  <span className="font-medium">Temperature:</span> {request.temperature}
                </div>
              )}
              {request.modelPreferences && (
                <div className="text-sm">
                  <span className="font-medium">Model Preferences:</span>
                  <div className="ml-2 text-xs text-muted-foreground">
                    {request.modelPreferences.speedPriority && 
                      `Speed: ${request.modelPreferences.speedPriority}`}
                    {request.modelPreferences.intelligencePriority && 
                      ` Intelligence: ${request.modelPreferences.intelligencePriority}`}
                    {request.modelPreferences.costPriority && 
                      ` Cost: ${request.modelPreferences.costPriority}`}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Prompt */}
          {request.systemPrompt && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm p-3 bg-muted rounded text-muted-foreground">
                  {request.systemPrompt}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Message to Analyze</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm p-3 bg-muted rounded">
                {mainMessage}
              </div>
            </CardContent>
          </Card>

          {/* Prompt Editor */}
          {showPromptEditor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Edit System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={modifiedPrompt || request.systemPrompt || ''}
                  onChange={(e) => setModifiedPrompt(e.target.value)}
                  placeholder="Modify the system prompt..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={handleDeny}>
            Deny
          </Button>
          {!showPromptEditor && (
            <Button 
              variant="outline" 
              onClick={() => setShowPromptEditor(true)}
            >
              Edit Prompt
            </Button>
          )}
          <Button onClick={handleApprove}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}