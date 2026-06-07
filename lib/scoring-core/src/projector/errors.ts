export class SequenceConflictError extends Error {
  readonly code = "SEQUENCE_CONFLICT" as const;
  readonly expectedSequence: number;
  readonly actualSequence: number;

  constructor(expectedSequence: number, actualSequence: number) {
    super(
      `Sequence conflict: expected ${expectedSequence}, but current sequence is ${actualSequence}`,
    );
    this.name = "SequenceConflictError";
    this.expectedSequence = expectedSequence;
    this.actualSequence = actualSequence;
  }
}

export class ReducerNotImplementedError extends Error {
  readonly code = "REDUCER_NOT_IMPLEMENTED" as const;
  readonly eventType: string;

  constructor(eventType: string) {
    super(`Reducer not implemented for event type: ${eventType}`);
    this.name = "ReducerNotImplementedError";
    this.eventType = eventType;
  }
}

export class InvalidEventPayloadError extends Error {
  readonly code = "INVALID_EVENT_PAYLOAD" as const;
  readonly eventType: string;

  constructor(eventType: string, message: string) {
    super(`Invalid payload for ${eventType}: ${message}`);
    this.name = "InvalidEventPayloadError";
    this.eventType = eventType;
  }
}
