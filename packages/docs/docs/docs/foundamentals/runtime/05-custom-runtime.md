# Custom Runtime

Mondrian Framework is designed for extensibility, allowing developers to create custom runtimes beyond the standard ones provided (REST, GraphQL, SQS, etc.). A custom runtime defines how and when Mondrian functions within a module are executed in response to specific external triggers or environments.

## Concept

Building a custom runtime involves implementing the core logic that bridges an external system or trigger mechanism with the Mondrian module execution flow:

1.  **Trigger Mechanism:** Define what event or condition triggers the execution (e.g., receiving a WebSocket message, detecting a file change, responding to a specific OS signal, integrating with a proprietary protocol).
2.  **Request/Event Handling:** Implement the logic to receive and interpret the incoming request, message, or event data from the trigger source.
3.  **Function Selection:** Determine which Mondrian function(s) within the target module should be invoked based on the incoming data or trigger context.
4.  **Input Extraction & Decoding:** Extract relevant data from the trigger source and decode it into the Mondrian function's expected input type. This might involve custom parsing or transformation logic.
5.  **Context Building:** Implement the `context` builder function required by the Mondrian module, gathering necessary information from the trigger source or runtime environment.
6.  **Function Invocation:** Use the Mondrian module's `rawApply` or `apply` methods (or potentially the Mondrian Client interface) to execute the selected function with the decoded input and built context.
7.  **Response/Result Handling:** Process the result (success or failure) returned by the Mondrian function and translate it back into an appropriate response or action within the custom runtime's environment (e.g., sending a WebSocket reply, updating a status, logging the outcome).

## Use Cases

- Integrating with message brokers other than SQS/Kafka (e.g., RabbitMQ, NATS).
- Building WebSocket-based APIs.
- Creating desktop applications where UI events trigger Mondrian functions.
- Interfacing with specific hardware or IoT devices.
- Adapting Mondrian modules to run within unique hosting environments or legacy systems.

## Implementation

Creating a custom runtime requires a deep understanding of both the Mondrian module interface (`@mondrian-framework/module`) and the specific requirements of the target environment or protocol. It involves writing the "glue code" that handles the steps outlined above, effectively teaching Mondrian how to operate within that new context.
