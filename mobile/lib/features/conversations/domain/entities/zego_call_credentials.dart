final class ZegoCallCredentials {
  const ZegoCallCredentials({
    required this.appId,
    required this.appSign,
    required this.userId,
    required this.userName,
    required this.token,
    required this.expiresAt,
  });

  final int appId;
  final String appSign;
  final String userId;
  final String userName;
  final String token;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().toUtc().isAfter(expiresAt);
}
