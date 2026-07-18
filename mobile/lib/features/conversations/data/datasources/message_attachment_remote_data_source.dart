import 'package:dio/dio.dart';

import '../../../../core/network/api_response.dart';
import '../../../../core/network/api_transport.dart';
import '../../domain/entities/chat_message.dart';

final class MessageAttachmentRemoteDataSource {
  const MessageAttachmentRemoteDataSource(this._api);

  final ApiTransport _api;

  Future<UploadedMessageFile> uploadFile({
    required String workspaceId,
    required PickedMessageAttachment attachment,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        attachment.path,
        filename: attachment.fileName,
        contentType: DioMediaType.parse(attachment.mimeType),
      ),
    });
    final response = await _api.post<Object>(
      '/api/v1/workspaces/${_e(workspaceId)}/files',
      data: form,
      options: Options(contentType: Headers.multipartFormDataContentType),
    );
    return _uploadedFileFromMap(envelopeItem(response.data, 'file'));
  }

  Future<MessageAttachment> attachFile({
    required String workspaceId,
    required String channelId,
    required String messageId,
    required String fileId,
    int sortOrder = 0,
  }) async {
    final response = await _api.post<Object>(
      '/api/v1/workspaces/${_e(workspaceId)}/channels/${_e(channelId)}/messages/${_e(messageId)}/attachments',
      data: {'file_id': fileId, 'sort_order': sortOrder},
    );
    return _attachmentFromMap(envelopeItem(response.data, 'attachment'));
  }

  Future<List<MessageAttachment>> listAttachments({
    required String workspaceId,
    required String channelId,
    required String messageId,
  }) async {
    final response = await _api.get<Object>(
      '/api/v1/workspaces/${_e(workspaceId)}/channels/${_e(channelId)}/messages/${_e(messageId)}/attachments',
    );
    return envelopeList(
      response.data,
      'attachments',
    ).map(_attachmentFromMap).toList(growable: false);
  }
}

MessageAttachment _attachmentFromMap(JsonMap map) {
  final fileMap = jsonMap(field(map, const ['file']));
  final file = _uploadedFileFromMap(fileMap);
  final fileId = stringField(map, const [
    'file_id',
    'fileId',
  ], fallback: file.id);
  final messageId = stringField(map, const ['message_id', 'messageId']);
  return MessageAttachment(
    id: stringField(map, const ['id'], fallback: '$messageId:$fileId'),
    workspaceId: stringField(map, const ['workspace_id', 'workspaceId']),
    messageId: messageId,
    fileId: fileId,
    sortOrder: intField(map, const ['sort_order', 'sortOrder']),
    createdAt: dateTimeField(map, const ['created_at', 'createdAt']),
    file: file,
  );
}

UploadedMessageFile _uploadedFileFromMap(JsonMap map) {
  final id = stringField(map, const ['id', 'file_id', 'fileId']);
  return UploadedMessageFile(
    id: id,
    name: stringField(map, const [
      'name',
      'file_name',
      'original_name',
      'originalName',
    ], fallback: 'file'),
    mimeType: stringField(map, const ['mime_type', 'mimeType']),
    byteSize: intField(map, const ['byte_size', 'byteSize', 'size']),
    downloadPath: stringField(map, const [
      'download_url',
      'downloadUrl',
      'url',
    ], fallback: id.isEmpty ? '' : '/files/$id/download'),
    status: stringField(map, const ['status'], fallback: 'ready'),
    createdAt: dateTimeField(map, const ['created_at', 'createdAt']),
  );
}

String _e(String value) => Uri.encodeComponent(value);
