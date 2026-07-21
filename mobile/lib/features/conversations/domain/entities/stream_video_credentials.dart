final class StreamVideoCredentials {
  const StreamVideoCredentials({
    required this.apiKey,
    required this.userId,
    required this.token,
    required this.expiresAt,
  });

  final String apiKey;
  final String userId;
  final String token;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().toUtc().isAfter(expiresAt);
}
