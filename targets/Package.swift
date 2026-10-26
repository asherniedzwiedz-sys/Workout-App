// swift-tools-version:5.9
// MotionCore = the watch app's pure motion code (targets/watch/MotionCore), built here so it can be
// unit-tested and replayed against exported CSVs on a Mac:  cd targets && swift test
//                                                           cd targets && swift run motion-replay export.csv
import PackageDescription

let package = Package(
    name: "MotionCore",
    platforms: [.macOS(.v13), .watchOS(.v10)],
    products: [
        .library(name: "MotionCore", targets: ["MotionCore"]),
        .executable(name: "motion-replay", targets: ["MotionReplay"]),
    ],
    targets: [
        .target(name: "MotionCore", path: "watch/MotionCore"),
        .executableTarget(name: "MotionReplay", dependencies: ["MotionCore"], path: "MotionReplay"),
        .testTarget(name: "MotionCoreTests", dependencies: ["MotionCore"], path: "MotionCoreTests"),
    ]
)
