import SwiftUI

/// Shared thumbnail used by Watchlist and Purchases rows — validates the
/// image URL via `safeEbayImageURL` before ever handing it to `AsyncImage`,
/// falling back to `placeholderSystemImage` when there's no image or it
/// doesn't pass validation.
struct RecordThumbnail: View {
    let imageUrl: String?
    let placeholderSystemImage: String

    var body: some View {
        Group {
            if let url = safeEbayImageURL(imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 88, height: 88)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(.quaternary)
            .overlay {
                Image(systemName: placeholderSystemImage)
                    .foregroundStyle(.secondary)
            }
    }
}
