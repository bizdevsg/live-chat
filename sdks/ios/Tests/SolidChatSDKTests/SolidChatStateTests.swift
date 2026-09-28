import XCTest
@testable import SolidChatSDK

final class SolidChatStateTests: XCTestCase {
    func testEndedStateMatchesWidget() {
        var state = SolidChatState()
        state.conversation = Conversation(id: "conversation", status: "OPEN", handlerType: "AI", assignedAgentId: nil)
        XCTAssertFalse(state.ended)
        state.conversation?.status = "RESOLVED"
        XCTAssertTrue(state.ended)
        state.conversation?.status = "CLOSED"
        XCTAssertTrue(state.ended)
    }
}
