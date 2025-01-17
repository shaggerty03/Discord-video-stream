# API Endpoints Documentation

Base URL: `http://localhost:3000`

## Endpoints

### Play Stream
- **URL**: `/play`
- **Method**: `POST`
- **Description**: Starts streaming video in the voice channel where the specified user is connected
- **Request Body**:
  ```json
  {
    "author": "686107711829704725"  // Discord User ID
  }
  ```
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Stream has started"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
    ```json
    {
      "error": "Author ID is required"
    }
    ```
  - **Code**: `400`
    ```json
    {
      "error": "User is not in a voice channel"
    }
    ```
  - **Code**: `500`
    ```json
    {
      "error": "Error starting the stream"
    }
    ```
  - **Code**: `500`
    ```json
    {
      "error": "Server error"
    }
    ```

### Disconnect
- **URL**: `/disconnect`
- **Method**: `POST`
- **Description**: Disconnects from the voice channel and stops any active stream
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Disconnected from the voice channel"
    }
    ```
- **Error Response**:
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Stop Stream
- **URL**: `/stop-stream`
- **Method**: `POST`
- **Description**: Stops the current stream without disconnecting from the voice channel
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Stream has been stopped"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Pause Stream
- **URL**: `/pause`
- **Method**: `POST`
- **Description**: Pauses the current stream
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Stream has been paused"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing or already paused"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Resume Stream
- **URL**: `/resume`
- **Method**: `POST`
- **Description**: Resumes a paused stream
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Stream has been resumed"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently paused"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Seek Forward
- **URL**: `/seek-forward`
- **Method**: `POST`
- **Description**: Seeks forward 10 seconds in the stream
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Seeked forward 10 seconds"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Failed to seek forward"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Seek Backward
- **URL**: `/seek-backward`
- **Method**: `POST`
- **Description**: Seeks backward 10 seconds in the stream
- **Request Body**: None
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```json
    {
      "message": "Seeked backward 10 seconds"
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Failed to seek backward"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Seek To Time
- **URL**: `/seek-to`
- **Method**: `POST`
- **Description**: Seeks to a specific time in the stream
- **Request Body**:
  ```json
  {
    "time": "string"  // Format: "10s", "5m", "1h"
  }
  ```
- **Success Response**:
  - **Code**: `200`
  - **Content**:
    ```jsonf
    {
      "message": "Seeked to 10s"  // Example response, actual time will match request
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "Time must be provided in format: 10s, 5m, 1h"
    }
    ```
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing"
    }
    ```
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "Failed to seek. Use format: 10s, 5m, 1h"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

### Volume Control
- **URL**: `/volume`
- **Method**: `POST`
- **Description**: Gets or sets the stream volume
- **Request Body** (for setting volume):
  ```json
  {
    "volume": 50  // Number between 0-100
  }
  ```
- **Request Body** (for getting volume): 
  ```json
  {}
  ```
  or no body
- **Success Responses**:
  - **Code**: `200` (setting volume)
  - **Content**:
    ```json
    {
      "message": "Volume set to 50%"  // Percentage will match request
    }
    ```
  - **Code**: `200` (getting volume)
  - **Content**:
    ```json
    {
      "message": "Current volume is 50%"  // Actual current volume
    }
    ```
- **Error Responses**:
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "Volume must be a number between 0 and 100"
    }
    ```
  - **Code**: `400`
  - **Content**:
    ```json
    {
      "error": "No stream is currently playing"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Failed to set volume"
    }
    ```
  - **Code**: `500`
  - **Content**:
    ```json
    {
      "error": "Server error"
    }
    ```

## Example cURL Commands

### Start Stream
```bash
curl -X POST -H "Content-Type: application/json" -d '{"author": "686107711829704725"}' http://localhost:3000/play
```

### Set Volume to 50%
```bash
curl -X POST -H "Content-Type: application/json" -d '{"volume": 50}' http://localhost:3000/volume
```

### Get Current Volume
```bash
curl -X POST http://localhost:3000/volume
```

### Seek to Specific Time
```bash
curl -X POST -H "Content-Type: application/json" -d '{"time": "5m"}' http://localhost:3000/seek-to
```

### Pause Stream
```bash
curl -X POST http://localhost:3000/pause
```

### Resume Stream
```bash
curl -X POST http://localhost:3000/resume
```

### Stop Stream
```bash
curl -X POST http://localhost:3000/stop-stream
```

### Seek Forward 10 Seconds
```bash
curl -X POST http://localhost:3000/seek-forward
```

### Seek Backward 10 Seconds
```bash
curl -X POST http://localhost:3000/seek-backward
```

### Disconnect from Voice
```bash
curl -X POST http://localhost:3000/disconnect
```