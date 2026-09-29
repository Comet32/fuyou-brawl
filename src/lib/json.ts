// JSON for embedding inside <script type="application/json">.
export const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
