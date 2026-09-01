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
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(.quaternary)
            .overlay {
                Image(systemName: placeholderSystemImage)
                    .foregroundStyle(.secondary)
            }
    }
}
