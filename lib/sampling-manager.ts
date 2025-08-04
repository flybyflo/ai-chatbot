import type { SamplingRequest } from '@/components/sampling-approval-dialog'

type SamplingApprovalHandler = (request: SamplingRequest) => Promise<{
  approved: boolean
  modifiedSystemPrompt?: string
}>

class SamplingManager {
  private approvalHandler: SamplingApprovalHandler | null = null

  setApprovalHandler(handler: SamplingApprovalHandler | null) {
    this.approvalHandler = handler
  }

  async requestApproval(request: SamplingRequest): Promise<{
    approved: boolean
    modifiedSystemPrompt?: string
  }> {
    if (!this.approvalHandler) {
      console.warn('No sampling approval handler set, denying request for security')
      return { approved: false }
    }

    try {
      return await this.approvalHandler(request)
    } catch (error) {
      console.error('Error in sampling approval handler:', error)
      return { approved: false }
    }
  }

  generateRequestId(): string {
    return `sampling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export const samplingManager = new SamplingManager()