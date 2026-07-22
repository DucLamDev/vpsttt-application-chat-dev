import '../../../../core/network/api_response.dart';
import '../../../../core/network/api_transport.dart';
import '../../domain/entities/zego_call_credentials.dart';

final class ZegoCallRemoteDataSource {
  const ZegoCallRemoteDataSource(this._api);

  final ApiTransport _api;

  Future<ZegoCallCredentials> loadCredentials() async {
    final response = await _api.get<Object>('/api/v1/video/zego-token');
    return _credentialsFromMap(envelopeItem(response.data, 'zego_call'));
  }
}

ZegoCallCredentials _credentialsFromMap(JsonMap map) {
  return ZegoCallCredentials(
    appId: intField(map, const ['app_id', 'appId']),
    appSign: stringField(map, const ['app_sign', 'appSign']),
    userId: stringField(map, const ['user_id', 'userId']),
    userName: stringField(map, const ['user_name', 'userName']),
    token: stringField(map, const ['token']),
    expiresAt: dateTimeField(map, const ['expires_at', 'expiresAt']),
  );
}
