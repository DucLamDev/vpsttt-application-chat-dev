import 'package:image_picker/image_picker.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/result/result.dart';
import '../../domain/entities/avatar_upload.dart';
import '../../domain/repositories/avatar_repository.dart';

final class ImagePickerAvatarRepository implements AvatarPickerRepository {
  ImagePickerAvatarRepository({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<Result<PickedAvatar?>> pick(AvatarPickerSource source) async {
    try {
      final image = await _picker.pickImage(
        source: source == AvatarPickerSource.camera
            ? ImageSource.camera
            : ImageSource.gallery,
        imageQuality: 88,
        maxWidth: 1600,
      );
      if (image == null) {
        return const Success(null);
      }

      return Success(
        PickedAvatar(
          path: image.path,
          fileName: image.name,
          mimeType: image.mimeType ?? _mimeTypeFromName(image.name),
        ),
      );
    } on Object catch (error) {
      return FailureResult(
        Failure(
          kind: FailureKind.storage,
          message: 'Khong the chon anh dai dien.',
          code: 'AVATAR_PICK_FAILED',
          cause: error,
        ),
      );
    }
  }
}

String _mimeTypeFromName(String fileName) {
  final lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}
