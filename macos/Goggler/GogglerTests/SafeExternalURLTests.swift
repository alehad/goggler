import Testing
@testable import Goggler

/// Mirrors safe-external-url.test.mjs's own coverage for safeEbayImageUrl.
@Suite("safeEbayImageURL")
struct SafeExternalURLTests {
    @Test("Accepts a real eBay image CDN URL")
    func acceptsTrustedHost() {
        #expect(safeEbayImageURL("https://i.ebayimg.com/images/g/abc/s-l500.jpg")?.absoluteString == "https://i.ebayimg.com/images/g/abc/s-l500.jpg")
        #expect(safeEbayImageURL("https://ebaystatic.com/pic.jpg") != nil)
    }

    @Test("Rejects non-HTTPS")
    func rejectsNonHTTPS() {
        #expect(safeEbayImageURL("http://i.ebayimg.com/images/g/abc/s-l500.jpg") == nil)
    }

    @Test("Rejects a non-eBay host")
    func rejectsUntrustedHost() {
        #expect(safeEbayImageURL("https://evil.example.com/images/g/abc/s-l500.jpg") == nil)
    }

    @Test("Rejects a host that merely contains the trusted suffix")
    func rejectsLookalikeHost() {
        #expect(safeEbayImageURL("https://ebayimg.com.evil.example.com/pic.jpg") == nil)
    }

    @Test("Rejects local and private hosts")
    func rejectsLocalOrPrivateHosts() {
        #expect(safeEbayImageURL("https://localhost/pic.jpg") == nil)
        #expect(safeEbayImageURL("https://127.0.0.1/pic.jpg") == nil)
        #expect(safeEbayImageURL("https://192.168.1.1/pic.jpg") == nil)
        #expect(safeEbayImageURL("https://10.0.0.1/pic.jpg") == nil)
        #expect(safeEbayImageURL("https://169.254.1.1/pic.jpg") == nil)
        #expect(safeEbayImageURL("https://172.16.0.1/pic.jpg") == nil)
    }

    @Test("Rejects malformed input")
    func rejectsMalformedInput() {
        #expect(safeEbayImageURL("not a url") == nil)
        #expect(safeEbayImageURL("") == nil)
    }

    @Test("Handles nil")
    func handlesNil() {
        #expect(safeEbayImageURL(nil) == nil)
    }
}
