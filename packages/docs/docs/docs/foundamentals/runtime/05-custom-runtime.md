# Custom Runtime

Mondrian Framework is designed for extensibility, allowing developers to create custom runtimes beyond the standard ones provided (REST, GraphQL, SQS, etc.). A custom runtime defines how and when Mondrian functions within one or more modules are executed in response to specific external triggers or within particular environments.

## Concept

Building a custom runtime involves implementing the core logic that bridges an external system or trigger mechanism with the Mondrian module execution flow. Key steps include:

1.  **Trigger Mechanism:** Define what event or condition initiates execution (e.g., receiving a WebSocket message, detecting a file change, responding to a specific OS signal, integrating with a proprietary protocol).
2.  **Request/Event Handling:** Implement logic to receive and interpret the incoming request, message, or event data from the trigger source.
3.  **Function Selection:** Determine which Mondrian function(s) within the target module(s) should be invoked based on the incoming data or trigger context.
4.  **Input Extraction & Decoding:** Extract relevant data from the trigger source and use the appropriate Mondrian function's `decode` method (or `decodeWithoutValidation`) to transform it into the function's expected input type. This might involve custom parsing or data mapping before decoding.
5.  **Context Building:** Implement the logic to gather necessary information from the trigger source or runtime environment and provide it as input to the Mondrian module's `context` builder function.
6.  **Function Invocation:** Use the Mondrian module's `apply` method (or `rawApply` for lower-level control) to execute the selected function with the decoded input and the context built by the module's context builder.
7.  **Response/Result Handling:** Process the `Result` (success or failure) returned by the Mondrian function and use its `encode` method (or `encodeWithoutValidation`) to translate the output or error back into an appropriate response or action within the custom runtime's environment (e.g., sending a WebSocket reply, writing to a file, updating a status, logging the outcome).

## Use Cases

- Integrating with message brokers other than SQS/Kafka (e.g., RabbitMQ, NATS).
- Building WebSocket-based APIs.
- Creating desktop applications where UI events trigger Mondrian functions.
- Interfacing with specific hardware or IoT devices.
- Adapting Mondrian modules to run within unique hosting environments or legacy systems.

## Implementation

Creating a custom runtime requires a good understanding of both the Mondrian module interface (`@mondrian-framework/module`)—particularly the `apply`/`rawApply` methods and the context-building process—and the specific requirements of the target environment or protocol. It involves writing the "glue code" that orchestrates the steps outlined above, effectively teaching Mondrian how to operate within that new context.
