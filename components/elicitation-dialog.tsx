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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ElicitationRequest {
  id: string
  serverName: string
  message: string
  responseType: any
}

interface ElicitationDialogProps {
  request: ElicitationRequest | null
  isOpen: boolean
  onRespond: (action: 'accept' | 'decline' | 'cancel', data?: any) => void
  onClose: () => void
}

export function ElicitationDialog({
  request,
  isOpen,
  onRespond,
  onClose,
}: ElicitationDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [selectedChoice, setSelectedChoice] = useState<string>('')

  if (!request) return null

  const handleAccept = () => {
    let responseData = null

    if (typeof request.responseType === 'string') {
      // Simple scalar types
      const value = formData.value
      switch (request.responseType) {
        case 'string':
          responseData = value || ''
          break
        case 'number':
        case 'int':
          responseData = value ? Number(value) : 0
          break
        case 'boolean':
        case 'bool':
          responseData = formData.boolean === true
          break
        default:
          responseData = value || ''
      }
    } else if (Array.isArray(request.responseType)) {
      // Choice from list
      responseData = selectedChoice || request.responseType[0]
    } else if (typeof request.responseType === 'object' && request.responseType !== null) {
      // Structured object
      responseData = { ...formData }
    } else {
      responseData = formData.value || ''
    }

    onRespond('accept', responseData)
    resetForm()
  }

  const handleDecline = () => {
    onRespond('decline')
    resetForm()
  }

  const handleCancel = () => {
    onRespond('cancel')
    resetForm()
  }

  const resetForm = () => {
    setFormData({})
    setSelectedChoice('')
  }

  const updateFormData = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const renderFormFields = () => {
    if (typeof request.responseType === 'string') {
      switch (request.responseType) {
        case 'string':
          return (
            <Textarea
              placeholder="Enter your response..."
              value={formData.value || ''}
              onChange={(e) => updateFormData('value', e.target.value)}
              className="min-h-[100px]"
            />
          )
        case 'number':
        case 'int':
          return (
            <Input
              type="number"
              placeholder="Enter a number..."
              value={formData.value || ''}
              onChange={(e) => updateFormData('value', e.target.value)}
            />
          )
        case 'boolean':
        case 'bool':
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="boolean-input"
                checked={formData.boolean === true}
                onCheckedChange={(checked) => updateFormData('boolean', checked)}
              />
              <Label htmlFor="boolean-input">Yes</Label>
            </div>
          )
        default:
          return (
            <Input
              placeholder="Enter your response..."
              value={formData.value || ''}
              onChange={(e) => updateFormData('value', e.target.value)}
            />
          )
      }
    } else if (Array.isArray(request.responseType)) {
      return (
        <Select value={selectedChoice} onValueChange={setSelectedChoice}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an option..." />
          </SelectTrigger>
          <SelectContent>
            {request.responseType.map((option: string) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    } else if (typeof request.responseType === 'object' && request.responseType !== null) {
      // Handle structured objects like UserInfo, TaskPreferences
      const typeName = request.responseType.name || 'Object'
      
      if (typeName === 'UserInfo') {
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={formData.name || ''}
                onChange={(e) => updateFormData('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="Your age"
                value={formData.age || ''}
                onChange={(e) => updateFormData('age', Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email || ''}
                onChange={(e) => updateFormData('email', e.target.value)}
              />
            </div>
          </div>
        )
      } else if (typeName === 'TaskPreferences') {
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => updateFormData('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notification"
                checked={formData.notification === true}
                onCheckedChange={(checked) => updateFormData('notification', checked)}
              />
              <Label htmlFor="notification">Enable notifications</Label>
            </div>
            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline || ''}
                onChange={(e) => updateFormData('deadline', e.target.value)}
              />
            </div>
          </div>
        )
      } else {
        // Generic object - just show a text area
        return (
          <Textarea
            placeholder="Enter structured data (JSON format)..."
            value={formData.value || ''}
            onChange={(e) => updateFormData('value', e.target.value)}
            className="min-h-[100px]"
          />
        )
      }
    }

    return (
      <Input
        placeholder="Enter your response..."
        value={formData.value || ''}
        onChange={(e) => updateFormData('value', e.target.value)}
      />
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Input Required</DialogTitle>
          <DialogDescription>
            The MCP server &quot;{request.serverName}&quot; is requesting information from you.
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

          {/* Request Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Request</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm p-3 bg-muted rounded">
                {request.message}
              </div>
            </CardContent>
          </Card>

          {/* Response Type Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Expected Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-3">
                Type: {typeof request.responseType === 'object' && request.responseType !== null 
                  ? Array.isArray(request.responseType) 
                    ? 'Choice from options' 
                    : request.responseType.name || 'Structured object'
                  : request.responseType || 'Any'}
              </div>
              {renderFormFields()}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleDecline}>
            Decline
          </Button>
          <Button onClick={handleAccept}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}