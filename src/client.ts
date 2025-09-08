import { Run, RunResult } from './types';

export class Client {
  private base: string;
  private secret: string;

  constructor(base: string, secret: string) {
    this.base = base;
    this.secret = secret;
  }

  async getRuns(prefix: string, user: string, page: number, limit: number) {
    const response = await fetch(`${this.base}/runs?user=${user}&page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${prefix}/${this.secret}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch runs: ${response.statusText}`);
    }
    return (await response.json()) as {
      runs: RunResult[];
      total: number;
    };
  }

  async getRun(id: string, prefix: string, user: string) {
    const response = await fetch(`${this.base}/runs/${id}?user=${user}`, {
      headers: {
        Authorization: `Bearer ${prefix}/${this.secret}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch run: ${response.statusText}`);
    }
    return (await response.json()) as RunResult;
  }

  async newRun(config: Run, prefix: string) {
    const response = await fetch(`${this.base}/runs/new`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prefix}/${this.secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) {
      throw new Error(`Failed to create new run: ${response.statusText}`);
    }
    return (await response.json()) as {
      objectId: string;
      runId: string;
      prefix: string;
      queueSize: number;
      queueTime: number;
    };
  }

  async getRunProgress(id: string, prefix: string, user: string) {
    const response = await fetch(`${this.base}/runs/${id}/progress?user=${user}`, {
      headers: {
        Authorization: `Bearer ${prefix}/${this.secret}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch run progress: ${response.statusText}`);
    }
    return (await response.json()) as {
      status: string;
      progress: number;
      eta: number;
    };
  }

  async cancelRun(id: string, prefix: string, user: string) {
    const response = await fetch(`${this.base}/runs/${id}/cancel?user=${user}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${prefix}/${this.secret}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to cancel run: ${response.statusText}`);
    }
  }
}
