# V1Api

All URIs are relative to _http://localhost_

| Method                                                                              | HTTP request                                      | Description |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- | ----------- |
| [**createExposure**](#createexposure)                                               | **POST** /exposures                               |             |
| [**deleteExposure**](#deleteexposure)                                               | **DELETE** /exposures/{id}                        |             |
| [**discoverExposures**](#discoverexposures)                                         | **GET** /exposures/discovery                      |             |
| [**getConfig**](#getconfig)                                                         | **GET** /config                                   |             |
| [**getDashboard**](#getdashboard)                                                   | **GET** /dashboard                                |             |
| [**getExposure**](#getexposure)                                                     | **GET** /exposures/{id}                           |             |
| [**getExposureHistory**](#getexposurehistory)                                       | **GET** /exposures/history                        |             |
| [**getSchema**](#getschema)                                                         | **GET** /schema                                   |             |
| [**healthGet**](#healthget)                                                         | **GET** /health                                   |             |
| [**listExposures**](#listexposures)                                                 | **GET** /exposures                                |             |
| [**replaceExposure**](#replaceexposure)                                             | **PUT** /exposures/{id}                           |             |
| [**saveConfig**](#saveconfig)                                                       | **PUT** /config                                   |             |
| [**validateConfig**](#validateconfig)                                               | **POST** /config/validate                         |             |
| [**wellKnownOauthProtectedResourceMcpGet**](#wellknownoauthprotectedresourcemcpget) | **GET** /.well-known/oauth-protected-resource/mcp |             |

# **createExposure**

> ExposureResource createExposure()

### Example

```typescript
import { V1Api, Configuration, ExposureUpsertRequest } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let exposureUpsertRequest: ExposureUpsertRequest; // (optional)

const { status, data } = await apiInstance.createExposure(exposureUpsertRequest);
```

### Parameters

| Name                      | Type                      | Description | Notes |
| ------------------------- | ------------------------- | ----------- | ----- |
| **exposureUpsertRequest** | **ExposureUpsertRequest** |             |       |

### Return type

**ExposureResource**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: application/json, text/json, application/\*+json
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteExposure**

> deleteExposure()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.deleteExposure(id);
```

### Parameters

| Name   | Type         | Description | Notes                 |
| ------ | ------------ | ----------- | --------------------- |
| **id** | [**string**] |             | defaults to undefined |

### Return type

void (empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **discoverExposures**

> ExposureDiscoveryResource discoverExposures()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.discoverExposures();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**ExposureDiscoveryResource**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getConfig**

> HaproxyResourceSnapshot getConfig()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.getConfig();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**HaproxyResourceSnapshot**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getDashboard**

> DashboardSnapshot getDashboard()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.getDashboard();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**DashboardSnapshot**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getExposure**

> ExposureResource getExposure()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.getExposure(id);
```

### Parameters

| Name   | Type         | Description | Notes                 |
| ------ | ------------ | ----------- | --------------------- |
| **id** | [**string**] |             | defaults to undefined |

### Return type

**ExposureResource**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getExposureHistory**

> ExposureHistoryPage getExposureHistory()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let exposureId: string; // (optional) (default to undefined)
let cursor: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.getExposureHistory(exposureId, cursor, limit);
```

### Parameters

| Name           | Type         | Description | Notes                            |
| -------------- | ------------ | ----------- | -------------------------------- |
| **exposureId** | [**string**] |             | (optional) defaults to undefined |
| **cursor**     | [**string**] |             | (optional) defaults to undefined |
| **limit**      | [**number**] |             | (optional) defaults to 50        |

### Return type

**ExposureHistoryPage**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getSchema**

> HaproxySchema getSchema()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.getSchema();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**HaproxySchema**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **healthGet**

> healthGet()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.healthGet();
```

### Parameters

This endpoint does not have any parameters.

### Return type

void (empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listExposures**

> Array<ExposureResource> listExposures()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.listExposures();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**Array<ExposureResource>**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **replaceExposure**

> ExposureResource replaceExposure()

### Example

```typescript
import { V1Api, Configuration, ExposureUpsertRequest } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let id: string; // (default to undefined)
let exposureUpsertRequest: ExposureUpsertRequest; // (optional)

const { status, data } = await apiInstance.replaceExposure(id, exposureUpsertRequest);
```

### Parameters

| Name                      | Type                      | Description | Notes                 |
| ------------------------- | ------------------------- | ----------- | --------------------- |
| **exposureUpsertRequest** | **ExposureUpsertRequest** |             |                       |
| **id**                    | [**string**]              |             | defaults to undefined |

### Return type

**ExposureResource**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: application/json, text/json, application/\*+json
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **saveConfig**

> HaproxyResourceSnapshot saveConfig()

### Example

```typescript
import { V1Api, Configuration, HaproxyResourceSnapshot } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let haproxyResourceSnapshot: HaproxyResourceSnapshot; // (optional)

const { status, data } = await apiInstance.saveConfig(haproxyResourceSnapshot);
```

### Parameters

| Name                        | Type                        | Description | Notes |
| --------------------------- | --------------------------- | ----------- | ----- |
| **haproxyResourceSnapshot** | **HaproxyResourceSnapshot** |             |       |

### Return type

**HaproxyResourceSnapshot**

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: application/json, text/json, application/\*+json
- **Accept**: text/plain, application/json, text/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **validateConfig**

> validateConfig()

### Example

```typescript
import { V1Api, Configuration, HaproxyResourceSnapshot } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

let haproxyResourceSnapshot: HaproxyResourceSnapshot; // (optional)

const { status, data } = await apiInstance.validateConfig(haproxyResourceSnapshot);
```

### Parameters

| Name                        | Type                        | Description | Notes |
| --------------------------- | --------------------------- | ----------- | ----- |
| **haproxyResourceSnapshot** | **HaproxyResourceSnapshot** |             |       |

### Return type

void (empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: application/json, text/json, application/\*+json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **wellKnownOauthProtectedResourceMcpGet**

> wellKnownOauthProtectedResourceMcpGet()

### Example

```typescript
import { V1Api, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new V1Api(configuration);

const { status, data } = await apiInstance.wellKnownOauthProtectedResourceMcpGet();
```

### Parameters

This endpoint does not have any parameters.

### Return type

void (empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | OK          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
