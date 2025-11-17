# SAP ABAP Webhook Setup Guide

This guide provides step-by-step instructions for SAP developers to configure SAP systems to send webhook notifications to n8n.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Method 1: ABAP HTTP Client](#method-1-abap-http-client-recommended)
- [Method 2: Change Documents](#method-2-change-documents)
- [Method 3: SAP Gateway Events](#method-3-sap-gateway-events)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

To enable real-time webhooks from SAP to n8n, you need to configure SAP to send HTTP POST requests when specific events occur.

### Architecture

```
SAP System                  n8n Workflow
-----------                 ------------
  Event
  triggers   ────HTTP POST──>  Webhook
  ABAP code                    receives
                               event
```

---

## Prerequisites

### n8n Side

✅ n8n instance running and accessible from SAP network
✅ SAP OData Webhook trigger node configured
✅ Webhook URL copied from n8n
✅ Authentication token configured

### SAP Side

✅ ABAP development access (SE38, SE24, or Eclipse)
✅ Authority to create/modify programs
✅ HTTP(S) connectivity from SAP to n8n (check with SM59)
✅ SAP Gateway configured (for OData events)

### Network

✅ Firewall rules allow HTTP/HTTPS from SAP to n8n
✅ DNS resolution works (test with transaction SM59)
✅ SSL certificates valid (if using HTTPS)

---

## Method 1: ABAP HTTP Client (Recommended)

This method uses SAP's built-in HTTP client classes to send webhooks.

### Step 1: Create Function Module

Transaction: **SE37** (Function Builder)

1. Create function module `Z_SEND_N8N_WEBHOOK`
2. Add the following parameters:

**Import Parameters**:
```
IV_WEBHOOK_URL  TYPE STRING (Webhook URL from n8n)
IV_AUTH_TOKEN   TYPE STRING (Authentication token)
IV_EVENT_TYPE   TYPE STRING (e.g., 'created', 'updated')
IV_ENTITY_TYPE  TYPE STRING (e.g., 'SalesOrder', 'Material')
IV_ENTITY_KEY   TYPE STRING (Entity identifier)
IV_JSON_PAYLOAD TYPE STRING (Event data as JSON)
```

**Export Parameters**:
```
EV_HTTP_CODE    TYPE I      (HTTP response code)
EV_RESPONSE     TYPE STRING (Response from n8n)
EV_SUCCESS      TYPE ABAP_BOOL
```

**Exceptions**:
```
HTTP_ERROR
JSON_ERROR
```

### Step 2: Implement Function Module

```abap
FUNCTION z_send_n8n_webhook.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(IV_WEBHOOK_URL) TYPE  STRING
*"     VALUE(IV_AUTH_TOKEN) TYPE  STRING
*"     VALUE(IV_EVENT_TYPE) TYPE  STRING
*"     VALUE(IV_ENTITY_TYPE) TYPE  STRING
*"     VALUE(IV_ENTITY_KEY) TYPE  STRING
*"     VALUE(IV_JSON_PAYLOAD) TYPE  STRING
*"  EXPORTING
*"     VALUE(EV_HTTP_CODE) TYPE  I
*"     VALUE(EV_RESPONSE) TYPE  STRING
*"     VALUE(EV_SUCCESS) TYPE  ABAP_BOOL
*"  EXCEPTIONS
*"      HTTP_ERROR
*"      JSON_ERROR
*"----------------------------------------------------------------------

  DATA: lo_http_client TYPE REF TO if_http_client,
        lv_json        TYPE string,
        lv_code        TYPE i,
        lv_reason      TYPE string.

  " Initialize
  ev_success = abap_false.

  TRY.
      " Create HTTP client
      cl_http_client=>create_by_url(
        EXPORTING
          url                = iv_webhook_url
        IMPORTING
          client             = lo_http_client
        EXCEPTIONS
          argument_not_found = 1
          plugin_not_active  = 2
          internal_error     = 3
          OTHERS             = 4 ).

      IF sy-subrc <> 0.
        RAISE http_error.
      ENDIF.

      " Build JSON payload
      lv_json = '{' &&
                '"event": "' && iv_event_type && '",' &&
                '"entityType": "' && iv_entity_type && '",' &&
                '"entityKey": "' && iv_entity_key && '",' &&
                '"timestamp": "' && cl_abap_tstmp=>utclong2tstmp_str( utclong_current( ) ) && '",' &&
                '"data": ' && iv_json_payload &&
                '}'.

      " Configure HTTP request
      lo_http_client->request->set_method( 'POST' ).
      lo_http_client->request->set_content_type( 'application/json' ).

      " Add authentication header
      lo_http_client->request->set_header_field(
        name  = 'X-SAP-Signature'
        value = iv_auth_token ).

      " Add SAP-specific headers
      lo_http_client->request->set_header_field(
        name  = 'sap-client'
        value = sy-mandt ).

      lo_http_client->request->set_header_field(
        name  = 'sap-language'
        value = sy-langu ).

      " Set request body
      lo_http_client->request->set_cdata( lv_json ).

      " Set timeout (30 seconds)
      lo_http_client->propertytype_logon_popup = if_http_client=>co_disabled.
      lo_http_client->timeout = 30.

      " Send request
      lo_http_client->send(
        EXCEPTIONS
          http_communication_failure = 1
          http_invalid_state         = 2
          http_processing_failed     = 3
          OTHERS                     = 4 ).

      IF sy-subrc <> 0.
        RAISE http_error.
      ENDIF.

      " Receive response
      lo_http_client->receive(
        EXCEPTIONS
          http_communication_failure = 1
          http_invalid_state         = 2
          http_processing_failed     = 3
          OTHERS                     = 4 ).

      IF sy-subrc <> 0.
        RAISE http_error.
      ENDIF.

      " Get response details
      lo_http_client->response->get_status(
        IMPORTING
          code   = lv_code
          reason = lv_reason ).

      ev_http_code = lv_code.
      ev_response  = lo_http_client->response->get_cdata( ).

      " Check if successful (2xx status code)
      IF lv_code >= 200 AND lv_code < 300.
        ev_success = abap_true.
      ELSE.
        ev_success = abap_false.
      ENDIF.

      " Close connection
      lo_http_client->close( ).

    CATCH cx_root INTO DATA(lx_error).
      " Log error
      WRITE: / 'Error:', lx_error->get_text( ).
      RAISE http_error.
  ENDTRY.

ENDFUNCTION.
```

### Step 3: Create Wrapper Program

Transaction: **SE38** (ABAP Editor)

Create report `Z_SALES_ORDER_WEBHOOK`:

```abap
*&---------------------------------------------------------------------*
*& Report Z_SALES_ORDER_WEBHOOK
*&---------------------------------------------------------------------*
*& Sends webhook to n8n when sales order is created/changed
*&---------------------------------------------------------------------*
REPORT z_sales_order_webhook.

PARAMETERS: p_vbeln TYPE vbak-vbeln OBLIGATORY.  " Sales Order Number

DATA: lv_webhook_url TYPE string,
      lv_auth_token  TYPE string,
      lv_json        TYPE string,
      lv_http_code   TYPE i,
      lv_response    TYPE string,
      lv_success     TYPE abap_bool.

" Configuration (store in table TVARVC for production)
lv_webhook_url = 'https://your-n8n-instance.com/webhook/abc123'.
lv_auth_token  = 'your-secret-token-123'.

" Read sales order data
SELECT SINGLE * FROM vbak
  INTO @DATA(ls_vbak)
  WHERE vbeln = @p_vbeln.

IF sy-subrc <> 0.
  WRITE: / 'Sales order not found:', p_vbeln.
  RETURN.
ENDIF.

" Build JSON payload
lv_json = '{' &&
          '"SalesOrder": "' && ls_vbak-vbeln && '",' &&
          '"SoldToParty": "' && ls_vbak-kunnr && '",' &&
          '"PurchaseOrderByCustomer": "' && ls_vbak-bstkd && '",' &&
          '"SalesOrganization": "' && ls_vbak-vkorg && '",' &&
          '"DistributionChannel": "' && ls_vbak-vtweg && '",' &&
          '"Division": "' && ls_vbak-spart && '",' &&
          '"SalesOrderType": "' && ls_vbak-auart && '"' &&
          '}'.

" Send webhook
CALL FUNCTION 'Z_SEND_N8N_WEBHOOK'
  EXPORTING
    iv_webhook_url  = lv_webhook_url
    iv_auth_token   = lv_auth_token
    iv_event_type   = 'created'
    iv_entity_type  = 'SalesOrder'
    iv_entity_key   = p_vbeln
    iv_json_payload = lv_json
  IMPORTING
    ev_http_code    = lv_http_code
    ev_response     = lv_response
    ev_success      = lv_success
  EXCEPTIONS
    http_error      = 1
    json_error      = 2
    OTHERS          = 3.

IF sy-subrc = 0 AND lv_success = abap_true.
  WRITE: / 'Webhook sent successfully!'.
  WRITE: / 'HTTP Code:', lv_http_code.
  WRITE: / 'Response:', lv_response.
ELSE.
  WRITE: / 'Webhook failed!'.
  WRITE: / 'HTTP Code:', lv_http_code.
  WRITE: / 'Response:', lv_response.
ENDIF.
```

### Step 4: Integrate with Business Logic

Add webhook call to your business logic:

**Option A: User Exit**
```abap
" In user exit for sales order creation (e.g., USEREXIT_SAVE_DOCUMENT)
CALL FUNCTION 'Z_SEND_N8N_WEBHOOK'
  EXPORTING
    iv_webhook_url  = lv_webhook_url
    iv_auth_token   = lv_auth_token
    iv_event_type   = 'created'
    iv_entity_type  = 'SalesOrder'
    iv_entity_key   = vbak-vbeln
    iv_json_payload = lv_json
  IMPORTING
    ev_success      = lv_success
  EXCEPTIONS
    OTHERS          = 0.  " Don't fail transaction if webhook fails
```

**Option B: BAdI Implementation**
```abap
METHOD if_badi_interface~execute.
  " Your business logic here

  " Send webhook after successful processing
  CALL FUNCTION 'Z_SEND_N8N_WEBHOOK' IN BACKGROUND TASK
    EXPORTING
      iv_webhook_url  = lv_webhook_url
      iv_auth_token   = lv_auth_token
      iv_event_type   = 'created'
      iv_entity_type  = 'SalesOrder'
      iv_entity_key   = sales_order
      iv_json_payload = lv_json.

  COMMIT WORK.  " Trigger background task
ENDMETHOD.
```

**Option C: Event Handler**
```abap
CLASS lcl_event_handler DEFINITION.
  PUBLIC SECTION.
    CLASS-METHODS: on_sales_order_created
      FOR EVENT sales_order_created OF cl_sales_order
      IMPORTING sender vbeln.
ENDCLASS.

CLASS lcl_event_handler IMPLEMENTATION.
  METHOD on_sales_order_created.
    " Send webhook
    CALL FUNCTION 'Z_SEND_N8N_WEBHOOK' STARTING NEW TASK 'WEBHOOK'
      EXPORTING
        iv_webhook_url  = lv_webhook_url
        iv_auth_token   = lv_auth_token
        iv_event_type   = 'created'
        iv_entity_type  = 'SalesOrder'
        iv_entity_key   = vbeln
        iv_json_payload = lv_json.
  ENDMETHOD.
ENDCLASS.
```

---

## Method 2: Change Documents

Monitor change documents (CDHDR/CDPOS) and send webhooks for tracked changes.

### Step 1: Create Background Job Program

```abap
*&---------------------------------------------------------------------*
*& Report Z_N8N_CHANGE_DOC_MONITOR
*&---------------------------------------------------------------------*
*& Monitors change documents and sends webhooks
*&---------------------------------------------------------------------*
REPORT z_n8n_change_doc_monitor.

DATA: lt_cdhdr TYPE TABLE OF cdhdr,
      ls_cdhdr TYPE cdhdr,
      lv_timestamp TYPE timestamp.

" Get timestamp of last run (store in TVARVC or custom table)
SELECT SINGLE low FROM tvarvc
  INTO @lv_timestamp
  WHERE name = 'Z_N8N_LAST_RUN'
    AND type = 'P'.

IF sy-subrc <> 0.
  " First run - get changes from last hour
  lv_timestamp = cl_abap_tstmp=>subtract(
    tstmp = cl_abap_tstmp=>utclong2tstmp( utclong_current( ) )
    secs  = 3600 ).
ENDIF.

" Get recent changes for material master
SELECT * FROM cdhdr
  INTO TABLE @lt_cdhdr
  WHERE objectclas = 'MATERIAL'
    AND udate >= @sy-datum
    AND utime >= @lv_timestamp
  ORDER BY udate DESCENDING, utime DESCENDING.

LOOP AT lt_cdhdr INTO ls_cdhdr.
  " Read change details from CDPOS
  SELECT * FROM cdpos
    INTO TABLE @DATA(lt_cdpos)
    WHERE objectclas = @ls_cdhdr-objectclas
      AND objectid   = @ls_cdhdr-objectid
      AND changenr   = @ls_cdhdr-changenr.

  IF sy-subrc = 0.
    " Build JSON with old/new values
    DATA(lv_json) = build_change_json( lt_cdpos ).

    " Send webhook
    CALL FUNCTION 'Z_SEND_N8N_WEBHOOK' STARTING NEW TASK 'WEBHOOK'
      EXPORTING
        iv_webhook_url  = lv_webhook_url
        iv_auth_token   = lv_auth_token
        iv_event_type   = 'updated'
        iv_entity_type  = 'Material'
        iv_entity_key   = ls_cdhdr-objectid
        iv_json_payload = lv_json.
  ENDIF.
ENDLOOP.

" Update last run timestamp
UPDATE tvarvc
  SET low = cl_abap_tstmp=>utclong2tstmp_str( utclong_current( ) )
  WHERE name = 'Z_N8N_LAST_RUN'
    AND type = 'P'.

IF sy-subrc <> 0.
  INSERT INTO tvarvc VALUES (
    name = 'Z_N8N_LAST_RUN'
    type = 'P'
    low  = cl_abap_tstmp=>utclong2tstmp_str( utclong_current( ) )
  ).
ENDIF.

COMMIT WORK.
```

### Step 2: Schedule Background Job

Transaction: **SM36** (Define Background Job)

1. Job name: `Z_N8N_CHANGE_MONITOR`
2. ABAP program: `Z_N8N_CHANGE_DOC_MONITOR`
3. Frequency: Every 5 minutes (or as needed)
4. User: Technical user with appropriate authorities
5. Save and release job

---

## Method 3: SAP Gateway Events

Use SAP Gateway's built-in notification framework.

### Configuration Steps

Transaction: **/IWFND/MAINT_SERVICE**

1. Select your OData service
2. Go to "Settings" → "Notifications"
3. Configure webhook endpoint:
   - URL: Your n8n webhook URL
   - Method: POST
   - Authentication: Custom header
   - Header name: X-SAP-Signature
   - Header value: Your token
4. Enable notifications for specific entities
5. Test configuration

---

## Testing

### Test Function Module

Transaction: **SE37**

1. Open function module `Z_SEND_N8N_WEBHOOK`
2. Click "Test/Execute" (F8)
3. Enter test values:
   ```
   IV_WEBHOOK_URL  = https://your-n8n.com/webhook/abc123
   IV_AUTH_TOKEN   = your-token
   IV_EVENT_TYPE   = created
   IV_ENTITY_TYPE  = TestEntity
   IV_ENTITY_KEY   = TEST001
   IV_JSON_PAYLOAD = {"test": "data"}
   ```
4. Execute
5. Check `EV_SUCCESS` = X (true)
6. Check `EV_HTTP_CODE` = 200

### Test HTTP Connectivity

Transaction: **SM59** (RFC Destinations)

1. Create HTTP connection to external server
2. Test connection
3. Check response

### Test from ABAP

```abap
REPORT z_test_webhook.

DATA: lv_success TYPE abap_bool.

CALL FUNCTION 'Z_SEND_N8N_WEBHOOK'
  EXPORTING
    iv_webhook_url  = 'https://your-n8n.com/webhook/abc123'
    iv_auth_token   = 'your-token'
    iv_event_type   = 'test'
    iv_entity_type  = 'Test'
    iv_entity_key   = 'TEST001'
    iv_json_payload = '{"message": "Hello from SAP!"}'
  IMPORTING
    ev_success      = lv_success.

IF lv_success = abap_true.
  WRITE: / 'SUCCESS: Webhook sent'.
ELSE.
  WRITE: / 'FAILED: Webhook not sent'.
ENDIF.
```

---

## Troubleshooting

### HTTP Connection Failed

**Error**: `HTTP_COMMUNICATION_FAILURE`

**Solutions**:
1. Check firewall rules (transaction SM59)
2. Verify DNS resolution works
3. Test with PING in SAP
4. Check proxy settings (transaction SMICM)
5. Review SAP HTTP log (transaction SMICM → Go To → Trace Level → Set to 3)

### SSL Certificate Error

**Error**: `SSL Handshake Failed`

**Solutions**:
1. Import SSL certificate to SAP (transaction STRUST)
2. Add CA certificate chain
3. Test SSL connection in SM59
4. Or: Disable SSL verification (not recommended for production)

### Authentication Failure

**Error**: HTTP 401 Unauthorized

**Solutions**:
1. Verify token matches n8n configuration exactly
2. Check header name is correct: `X-SAP-Signature`
3. Ensure no extra spaces in token
4. Test with curl first to isolate issue

### Timeout Error

**Error**: `TIMEOUT`

**Solutions**:
1. Increase timeout in ABAP code (default: 30 seconds)
2. Check n8n server performance
3. Verify network latency (transaction SM59)
4. Consider using asynchronous calls (STARTING NEW TASK)

### JSON Parsing Error

**Error**: Invalid JSON in n8n

**Solutions**:
1. Validate JSON structure before sending
2. Escape special characters properly
3. Use JSON library (cl_fdt_json) for complex structures
4. Test JSON at jsonlint.com

---

## Best Practices

### Error Handling

✅ **Always use TRY-CATCH blocks**
```abap
TRY.
    CALL FUNCTION 'Z_SEND_N8N_WEBHOOK'
      EXPORTING ...
      EXCEPTIONS
        http_error = 1
        OTHERS     = 2.
  CATCH cx_root INTO DATA(lx_error).
    " Log error but don't fail transaction
    WRITE: / 'Webhook error:', lx_error->get_text( ).
ENDTRY.
```

✅ **Don't let webhook failures break business processes**
```abap
" Use EXCEPTIONS OTHERS = 0 to suppress errors
CALL FUNCTION 'Z_SEND_N8N_WEBHOOK'
  EXPORTING ...
  EXCEPTIONS
    OTHERS = 0.  " Continue even if webhook fails
```

✅ **Use background tasks for non-critical webhooks**
```abap
CALL FUNCTION 'Z_SEND_N8N_WEBHOOK' STARTING NEW TASK 'WEBHOOK'
  EXPORTING ...

COMMIT WORK.  " Trigger background processing
```

### Performance

✅ **Use asynchronous calls**
- Don't block user transactions
- Use `STARTING NEW TASK` or `IN BACKGROUND TASK`

✅ **Batch multiple events when possible**
- Collect events and send in one request
- Reduces HTTP overhead

✅ **Set appropriate timeouts**
- Default: 30 seconds
- Critical: 10 seconds
- Background: 60 seconds

### Security

✅ **Store credentials securely**
- Use TVARVC table or secure store
- Don't hardcode tokens in code
- Encrypt sensitive data

✅ **Use HTTPS, not HTTP**
```abap
lv_webhook_url = 'https://...'.  " ✓ Secure
lv_webhook_url = 'http://...'.   " ✗ Insecure
```

✅ **Validate data before sending**
- Sanitize user input
- Remove sensitive data (passwords, etc.)
- Validate JSON structure

### Monitoring

✅ **Log webhook calls**
```abap
" Write to application log
CALL FUNCTION 'BAL_LOG_MSG_ADD'
  EXPORTING
    i_log_handle = lv_log_handle
    i_s_msg      = ls_msg.
```

✅ **Track success/failure rates**
- Count successful webhooks
- Alert on high failure rates
- Review error patterns

✅ **Set up monitoring dashboard**
- Use transaction SLG1 (Application Log)
- Create custom monitoring reports
- Send alerts for failures

---

## Production Checklist

Before go-live, ensure:

- [ ] Function module tested in development
- [ ] Function module transported to production
- [ ] Webhook URL uses production n8n instance
- [ ] Authentication token is production token (not test)
- [ ] HTTPS used (not HTTP)
- [ ] SSL certificate imported and tested
- [ ] Firewall rules configured
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Background jobs scheduled (if applicable)
- [ ] Credentials stored in TVARVC (not hardcoded)
- [ ] Monitoring dashboard created
- [ ] Documentation updated
- [ ] Team trained on new process

---

## Support

For questions:
- SAP Development: Check transaction codes SE37, SE38, SE80
- HTTP Issues: Check transaction SM59, SMICM
- Webhook Issues: Review [WEBHOOK_GUIDE.md](WEBHOOK_GUIDE.md)
- n8n Issues: Check n8n execution logs

---

## Version History

- **v1.4.0**: Initial ABAP setup guide
  - HTTP Client method
  - Change Document monitoring
  - SAP Gateway events configuration
