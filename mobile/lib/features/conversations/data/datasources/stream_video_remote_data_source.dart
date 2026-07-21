import '../../../../core/network/api_response.dart';
import '../../../../core/network/api_transport.dart';
import '../../domain/entities/stream_video_credentials.dart';

final class StreamVideoRemoteDataSource {
  const StreamVideoRemoteDataSource(this._api);

  final ApiTransport _api;

  Future<StreamVideoCredentials> loadCredentials() async {
    final response = await _api.get<Object>('/api/v1/video/stream-token');
    return _credentialsFromMap(envelopeItem(response.data, 'stream_video'));
  }
}

StreamVideoCredentials _credentialsFromMap(JsonMap map) {
  return StreamVideoCredentials(
    apiKey: stringField(map, const ['api_key', 'apiKey']),
    userId: stringField(map, const ['user_id', 'userId']),
    token: stringField(map, const ['token']),
    expiresAt: dateTimeField(map, const ['expires_at', 'expiresAt']),
  );
}
