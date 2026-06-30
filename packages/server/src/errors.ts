export type FeedbackErrorStatus = 400 | 401 | 429 | 503;

export class FeedbackError extends Error {
  readonly status: FeedbackErrorStatus;
  constructor(status: FeedbackErrorStatus, message: string) {
    super(message);
    this.name = "FeedbackError";
    this.status = status;
  }
}
