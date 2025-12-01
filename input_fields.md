# Input Field Descriptions

This document provides a detailed description of every input field available in the SAP nodes.

## SAP OData API Credentials (`sapOdataApi`)

These are the settings required to connect to an SAP OData API.

*   **Host**: The full URL of the SAP OData service, including the protocol and port.
    *   *Example*: `https://your-sap-system.com:8443`
*   **Authentication**: The authentication method to use.
    *   `None`: No authentication. Used for public OData services.
    *   `Basic Auth`: Use a username and password.
*   **Username**: The SAP username for Basic Authentication.
*   **Password**: The SAP password for Basic Authentication.
*   **Ignore SSL Issues**: If enabled, the node will connect even if the SSL certificate cannot be validated.
    *   **⚠️ SECURITY WARNING**: This should only be used in development environments.
*   **SAP Client**: The SAP client number (Mandant). This is sent as the `sap-client` header.
    *   *Hint*: Common clients are 100 (DEV), 200 (QA), 300 (PROD).
*   **SAP Language**: The SAP language code. This is sent as the `sap-language` header.
    *   *Hint*: Common languages are EN (English), DE (German).
*   **Custom Headers**: Allows you to provide a JSON object of custom headers to be sent with every request.
*   **OData Version**: The OData protocol version to use.
    *   `Auto-Detect`: The node will try to determine the version from the service metadata.
    *   `OData V2`: Force the use of OData V2.
    *   `OData V4`: Force the use of OData V4.

---
## SAP RFC/BAPI API Credentials (`sapRfcApi`)

These settings are for connecting to an SAP system using the RFC protocol to call function modules and BAPIs. This requires the SAP NetWeaver RFC SDK to be installed on the n8n server.

*   **Connection Type**: Defines the method used to connect to the SAP system.
    *   `Direct Application Server`: Connect directly to a specific SAP application server.
    *   `Load Balancing`: Connect via a message server, which distributes the load across multiple application servers.

### Direct Connection Parameters

These fields are shown when `Connection Type` is `Direct Application Server`.

*   **Application Server Host**: The hostname or IP address of the SAP application server.
*   **System Number**: The two-digit SAP system number (e.g., `00`, `01`).

### Load Balancing Parameters

These fields are shown when `Connection Type` is `Load Balancing`.

*   **Message Server Host**: The hostname of the SAP message server.
*   **Message Server Service**: The service name or port number of the message server (optional).
*   **System ID**: The three-character SAP System ID (SID), e.g., `DEV`.
*   **Logon Group**: The logon group configured in SAP for load balancing, e.g., `PUBLIC`.

### Common Parameters

*   **SAP Client**: The three-digit SAP client number (Mandant).
*   **Username**: The SAP username for authentication.
*   **Password**: The SAP password for authentication.
*   **Language**: The SAP logon language, e.g., `EN`, `DE`.

### Advanced Options

*   **SAProuter String**: The connection string required if connecting to the SAP system through an SAProuter.
*   **Use SNC (Secure Network Communication)**: Enables SNC for a secure, encrypted connection.
*   **SNC Partner Name**: The SNC name of the communication partner (the SAP system).
*   **SNC QoP (Quality of Protection)**: The security level for the SNC connection, ranging from authentication only to full encryption.
*   **SNC My Name**: Your system's SNC name (optional).
*   **Connection Timeout (seconds)**: The time in seconds to wait for a connection to be established.

---
## SAP IDoc API Credentials (`sapIdocApi`)

These credentials are for sending IDocs to an SAP system via the legacy IDoc XML HTTP interface.

*   **SAP Host**: The SAP system hostname or IP address, including the protocol (`http://` or `https://`).
*   **Port**: The HTTP/HTTPS port for the IDoc listener on the SAP system.
    *   *Default*: `8000` for HTTP, `44300` for HTTPS.
*   **SAP Client**: The SAP client number (e.g., `100`, `800`).
*   **Username**: The SAP username for authentication.
*   **Password**: The SAP password for authentication.
*   **Ignore SSL Issues**: If enabled, the node will connect even if the SSL certificate validation fails.

---
## SAP OData Webhook API Credentials (`sapOdataWebhookApi`)

These credentials are used to authenticate incoming webhook requests from SAP OData services.

*   **Shared Secret or Token**: The secret key used for authentication. This can be a shared secret for HMAC signature validation or a static token for Header/Query authentication.
    *   *Hint*: For HMAC, a strong, randomly generated secret of at least 32 characters is recommended.
*   **Signature Algorithm**: The hash algorithm to use when validating an HMAC signature. This is only used for HMAC authentication.
    *   `SHA-256` (Recommended)
    *   `SHA-512`
*   **Signature Header Name**: The name of the HTTP header that will contain the authentication signature or token.
    *   *Default*: `X-SAP-Signature`

---
## SAP IDoc Webhook API Credentials (`sapIdocWebhookApi`)

These credentials are used to authenticate incoming IDoc webhook requests from an SAP system.

*   **Authentication Type**: The method to use for authenticating webhook requests.
    *   `HMAC Signature`: Secure signature-based authentication (recommended).
    *   `Basic Authentication`: Legacy username/password authentication (insecure).

### HMAC Signature Fields

*   **Shared Secret**: The shared secret key for HMAC signature validation. This must match the secret configured in the SAP system.
    *   *Hint*: Use a strong, randomly generated secret of at least 32 characters.
*   **Signature Algorithm**: The hash algorithm for the HMAC signature.
    *   `SHA-256` (Recommended)
    *   `SHA-512`

### Basic Authentication Fields

*   **Username**: The username for Basic Authentication.
*   **Password**: The password for Basic Authentication.

---
## SAP OData Node (`SapOData.node`)

This node connects to SAP systems via OData to perform various operations.

### Main Parameters

*   **Service Path Mode**: Determines how the OData service path is specified.
    *   `Auto-Discover`: Automatically loads available services from the SAP system. This is the recommended and easiest method.
    *   `From List`: Select a service from a pre-configured list, which can be filtered by category.
    *   `Custom`: Manually enter the service path.
*   **Service** (Auto-Discover mode): A dropdown list of services automatically discovered from your SAP system's Gateway Catalog.
*   **Service Category** (List mode): Filters the service list to show only services of a certain type (e.g., SAP Standard, Custom).
*   **Service** (List mode): A dropdown list of services filtered by the selected category.
*   **Custom Service Path**: Manually enter the path to the OData service, e.g., `/sap/opu/odata/sap/API_BUSINESS_PARTNER/`.
*   **Resource**: The type of OData resource to work with.
    *   `Entity`: Perform CRUD (Create, Read, Update, Delete) operations on OData entities.
    *   `Function Import`: Execute OData function imports.

### Entity Operations

These parameters are available when the `Resource` is set to `Entity`.

*   **Operation**: The action to perform on the entity.
    *   `Get Many`: Retrieve multiple entities.
    *   `Get`: Retrieve a single entity by its key.
    *   `Create`: Create a new entity.
    *   `Update`: Update an existing entity.
    *   `Delete`: Delete an entity.
*   **Entity Set Mode**: How to specify the entity set (the collection of entities, e.g., "SalesOrders").
    *   `From List`: Select from a list of entity sets discovered from the service metadata.
    *   `Custom`: Manally enter the entity set name.
*   **Entity Set Name**: A dropdown list of entity sets automatically discovered from the service metadata.
*   **Custom Entity Set Name**: Manually enter the name of the entity set.
*   **Entity**: The specific entity to get, update, or delete. This is specified by its key.
    *   **By ID**: Enter the key value directly. For simple keys, this can be a number or a string (e.g., `'0500000001'`). For composite keys, use the format `Key1='A',Key2=123`.
    *   **By URL**: Paste the full URL of the entity. The node will automatically extract the key.
*   **Return All**: If enabled, the node will automatically fetch all pages of a result set. Use with caution on large data sets.
*   **Limit**: The maximum number of results to return when `Return All` is disabled.
*   **Data**: The data for the new or updated entity, provided as a JSON object.

### Options (for Get/Get Many)

This is a collection of standard OData query options to control the data you retrieve.

*   **$select**: A comma-separated list of properties to return (e.g., `Name,City`).
*   **$expand**: A comma-separated list of related entities to include in the result.
*   **$filter**: An OData filter expression to filter the results (e.g., `City eq 'Berlin'`).
*   **$orderby**: A property or list of properties to sort the results by (e.g., `Name asc`).
*   **$skip**: The number of results to skip (for pagination).
*   **$count**: If enabled, the result will include a count of all matching entities.
*   **$search**: A free-text search across all properties (OData V4 only).
*   **$apply**: Apply data aggregation functions (OData V4 only).
*   **Batch Size**: The number of items to retrieve per HTTP request during pagination.
*   **ETag**: An ETag value for optimistic locking, used to prevent concurrent modifications when updating or deleting an entity.

### Function Import Operations

These parameters are available when the `Resource` is set to `Function Import`.

*   **Function Name Mode**: How to specify the function import name.
    *   `From List`: Select from a list of functions discovered from the service metadata.
    *   `Custom`: Manually enter the function name.
*   **Function Name**: A dropdown list of function imports automatically discovered from the service metadata.
*   **Custom Function Name**: Manually enter the name of the function import.
*   **HTTP Method**: The HTTP method to use for the function call.
    *   `GET`: For read-only functions.
    *   `POST`: For functions that modify data.
*   **URL Format** (GET only): The format for passing parameters in the URL.
    *   `Canonical`: `/FunctionName(param1=value1,param2=value2)`
    *   `Query String`: `/FunctionName?param1=value1&param2=value2`
*   **Function Parameters**: The parameters for the function, provided as a JSON object.

### Advanced Options

A collection of advanced settings for performance, data conversion, and resilience.

*   **Performance: Max Items to Fetch**: A safety limit to prevent out-of-memory errors when fetching very large datasets (0 = no limit).
*   **Performance: Continue on Pagination Errors**: If enabled, partial results will be returned even if some pages fail to load during pagination.
*   **Data: Convert SAP Data Types**: Whether to automatically convert SAP-specific data types (like numeric strings and `/Date(...)/`) to native JavaScript types.
*   **Data: Remove Metadata**: Whether to remove the `__metadata` field from the results for a cleaner output.
*   **Connection: Pool - Keep Alive**: Whether to keep HTTP connections alive for reuse, improving performance.
*   **Connection: Pool - Max Sockets**: The maximum number of concurrent connections per host.
*   **Connection: Pool - Max Free Sockets**: The maximum number of idle connections to keep in the pool.
*   **Connection: Pool - Socket Timeout**: The timeout in milliseconds for an active connection.
*   **Connection: Pool - Free Socket Timeout**: The timeout in milliseconds for an idle connection.
*   **Cache: Clear Before Execution**: Whether to clear cached data (like CSRF tokens and service metadata) before the node runs.
*   **Output: Include Metrics**: Whether to add an item to the output containing performance metrics like execution time and API calls.
*   **Debug: Enable Logging**: Whether to log detailed request and response information for troubleshooting.
*   **Resilience: Enable Retry**: Whether to automatically retry failed requests on network errors or specific server statuses (429, 503, 504).
*   **Resilience: Max Retry Attempts**: The maximum number of times to retry a failed request.
*   **Resilience: Initial Retry Delay (ms)**: The initial time to wait before the first retry. The delay increases exponentially for subsequent retries.
*   **Resilience: Max Retry Delay (ms)**: The maximum time to wait between retries, capping the exponential backoff.
*   **Resilience: Backoff Factor**: The multiplier for the exponential backoff (e.g., 2 means the delay doubles with each retry).

---
## SAP IDoc Node (`SapIdoc.node`)

This node is used to send SAP IDocs (Intermediate Documents) or build the corresponding XML.

### Main Parameters

*   **Operation**: The action to perform.
    *   `Send IDoc`: Build the IDoc XML from the input data and send it to the SAP system.
    *   `Build IDoc XML`: Build the IDoc XML from the input data and return it in the output without sending it. This is useful for debugging.
*   **IDoc Type**: The type of IDoc to send, e.g., `DEBMAS` for customer master data. A list of common types is provided.
*   **Custom IDoc Type**: If `IDoc Type` is set to `Custom`, you can manually enter the IDoc type name here.
*   **Input Mode**: How the IDoc data is provided to the node.
    *   `JSON Data`: Provide the entire IDoc structure as a single JSON object.
    *   `XML String`: Provide the entire IDoc as a raw XML string.
    *   `Manual Builder`: Use a form-based UI to build the IDoc structure.

### Input Modes

*   **IDoc Data (JSON)**: A JSON editor to provide the IDoc data. The structure should contain a `controlRecord` object and a `dataRecords` array.
*   **IDoc XML**: A text field to paste the complete IDoc XML.

### Manual Builder Mode

*   **Control Record Fields**: A form to enter the fields for the IDoc's control record (`EDI_DC40` segment), such as Message Type, Sender Port, Receiver Port, etc.
*   **Data Segments**: A list where you can add multiple data segments for the IDoc.
    *   **Segment Type**: The name of the SAP segment, e.g., `E1KNA1M`.
    *   **Parent Segment ID**: The ID of the parent segment for creating hierarchical IDocs (optional).
    *   **Fields (JSON)**: A JSON object containing the key-value pairs for the fields within this segment.

### Options

A collection of advanced settings for controlling the IDoc generation and sending process.

*   **Generate DOCNUM**: If enabled, a unique IDoc document number will be automatically generated. If disabled, you must provide a `DOCNUM` in the control record.
*   **Direction**: The direction of the IDoc.
    *   `Inbound (to SAP)`
    *   `Outbound (from SAP)`
*   **Remove Whitespace**: Whether to remove whitespace from the final XML. This is required by most SAP systems.
*   **Validate XML**: Whether to perform a basic validation of the XML structure before sending.

---
## SAP RFC/BAPI Node (`SapRfc.node`)

This node allows you to call SAP function modules and BAPIs directly using the RFC protocol.

### Main Parameters

*   **Operation**: The type of RFC call to make.
    *   `Call Function`: Call a single RFC function module.
    *   `Call Multiple Functions (Stateful)`: Call a sequence of functions in the same session. This is useful for BAPI transactions that require multiple steps followed by a commit.

### Single Function Call Parameters

These parameters are available when `Operation` is `Call Function`.

*   **Function Name**: The name of the RFC function module or BAPI to call, e.g., `BAPI_USER_GET_DETAIL`.
*   **Input Mode**: How to provide the parameters for the function call.
    *   `JSON`: Provide all parameters as a single JSON object.
    *   `Structured`: Use a form-based UI to define the parameters.
*   **Parameters (JSON)**: A JSON editor for providing the function's import and table parameters.
*   **Import Parameters** (Structured mode): A list for adding the import parameters of the function.
    *   **Name**: The name of the parameter.
    *   **Type**: The data type of the parameter (String, Number, Boolean, or Structure).
    *   **Value**: The value of the parameter. For structures, this should be a JSON object.
*   **Table Parameters** (Structured mode): A list for adding the table parameters of the function.
    *   **Name**: The name of the table parameter.
    *   **Rows (JSON Array)**: The rows of the table, provided as a JSON array of objects.

### Multiple Function Call Parameters

These parameters are available when `Operation` is `Call Multiple Functions (Stateful)`.

*   **Functions**: A list where you can define the sequence of functions to be called.
    *   **Function Name**: The name of the RFC function module.
    *   **Parameters (JSON)**: A JSON object containing the parameters for this specific function call.
    *   **Commit After**: If enabled, the node will call `BAPI_TRANSACTION_COMMIT` immediately after this function call.

### Options

A collection of advanced settings for controlling the RFC call and its results.

*   **Connection Pool**: Whether to use a pool of RFC connections for better performance on multiple calls.
*   **Timeout (seconds)**: The timeout in seconds for the function call.
*   **Auto Commit**: If enabled, `BAPI_TRANSACTION_COMMIT` will be automatically called after a single function call.
*   **Return Import Parameters**: Whether to include the function's import parameters in the node's output.
*   **Return Tables**: Whether to include the function's table parameters in the node's output.
*   **Check RETURN Structure**: Whether to automatically check the `RETURN` structure (a common pattern in BAPIs) for error messages.
*   **Throw on BAPI Error**: If `Check RETURN Structure` is enabled, this setting determines whether the node should throw an error if an error message (type 'E' or 'A') is found in the `RETURN` structure.

---
## SAP OData Webhook Trigger (`SapODataWebhook.node`)

This trigger node receives real-time events from SAP OData services. It can automatically register itself with the SAP Gateway, but requires `SAP OData API` credentials to do so.

### Authentication

*   **Authentication**: The method used to authenticate incoming webhook requests.
    *   `None`: No authentication.
    *   `HMAC Signature`: (Recommended) Validate the request using an HMAC signature.
    *   `Header Auth`: Validate using a static token in an HTTP header.
    *   `Query String`: Validate using a static token in a URL query parameter.
*   **Header Name**: The name of the HTTP header containing the authentication signature or token (for HMAC and Header Auth).
*   **Header Value**: The expected secret token value in the header (for Header Auth).
*   **Query Parameter Name**: The name of the URL query parameter containing the token (for Query Auth).
*   **Query Parameter Value**: The expected secret token value in the query parameter (for Query Auth).

### Response

*   **Response**: When to respond to the webhook request.
    *   `Immediately`: Respond as soon as the event is received.
    *   `When Workflow Finishes`: Wait for the workflow to finish executing before sending a response.
*   **Response Code**: The HTTP status code to return (e.g., `200`).

### Event Filtering

*   **Event Filter**: Filter which events should trigger the workflow.
    *   `All Events`: Trigger on all incoming events.
    *   `Specific Entity Type`: Filter by the name of the SAP entity (e.g., `SalesOrder`).
    *   `Specific Operation`: Filter by the operation type (Create, Update, Delete).
*   **Entity Type**: A comma-separated list of entity types to trigger on.
*   **Operation Type**: A list of operations to trigger on (Create, Update, Delete).

### Options

*   **Validate SAP Payload Format**: Whether to validate that the incoming data matches the expected SAP OData event format.
*   **Extract Changed Fields Only**: Whether to extract only the fields that have changed between the old and new versions of an entity (requires the payload to contain both).
*   **Parse SAP Date Formats**: Whether to automatically convert SAP date formats (e.g., `/Date(...)/`) to standard ISO 8601 strings.
*   **IP Whitelist**: A comma-separated list of allowed IP addresses or CIDR ranges to restrict where events can be sent from.
*   **Custom Response Body**: A JSON object to be sent as the response body.

---
## SAP IDoc Webhook Trigger (`SapIdocWebhook.node`)

This trigger node receives SAP IDocs via HTTP. The endpoint must be configured manually in the SAP system.

### Authentication

*   **Authentication**: The method used to authenticate incoming IDoc webhook requests.
    *   `None`: No authentication.
    *   `HMAC Signature`: (Recommended) Validate the request using an HMAC signature sent in a header.
    *   `Basic Auth (Legacy)`: Validate using a username and password. This is insecure and should only be used over HTTPS.
*   **Security Warning**: A notice that appears when `Basic Auth` is selected, warning that it is insecure.
*   **Signature Header Name**: The name of the HTTP header that contains the HMAC signature.

### Filtering

*   **Filter by IDoc Type**: If enabled, the workflow will only trigger if the incoming IDoc matches the specified type.
*   **IDoc Type**: A list of common IDoc types to filter on.
*   **Custom IDoc Type**: Manually enter a custom IDoc type to filter on.

### Response

*   **Response Mode**: How the node should respond to SAP after receiving the IDoc.
    *   `Success Only`: Always return a success (200 OK) response.
    *   `Auto-Detect`: Return success if the workflow executes successfully, or an error if it fails.
    *   `Custom Response`: The response is determined by the output of the workflow.

### Options

*   **Parse to JSON**: Whether to parse the incoming IDoc XML into a structured JSON object. If disabled, the raw XML is passed through.
*   **Include Raw XML**: If `Parse to JSON` is enabled, this option will also include the original raw XML in the output.
*   **Validate IDoc Structure**: Whether to perform a basic validation on the incoming XML to ensure it looks like an IDoc.
*   **Log Received IDocs**: Whether to log a summary of each received IDoc to the n8n logs.
*   **Extract Segments as Array**: If `Parse to JSON` is enabled, this option will extract all IDoc segments into a flat array, which can be easier to process in a workflow.

---