import CoreML
import Foundation

/// Phase 9C: on-device Core ML inference, no network. Loads ExerciseClassifier.mlmodel (compiled into the
/// bundle as .mlmodelc) once you've trained one with ml/train.ipynb and dropped it into targets/watch.
/// Without a model every detected set falls back to "Not sure — pick exercise" (rep counting still works).
// Not named ExerciseClassifier: Xcode generates a class with that name from the .mlmodel.
final class MotionClassifier {
    private let model: MLModel?
    private let inputName: String
    let labels: Set<String>

    init() {
        let model = Bundle.main.url(forResource: "ExerciseClassifier", withExtension: "mlmodelc").flatMap { try? MLModel(contentsOf: $0) }
        self.model = model
        inputName = model?.modelDescription.inputDescriptionsByName.keys.first ?? "motion"
        labels = Set((model?.modelDescription.classLabels ?? []).compactMap { $0 as? String })
    }

    var isAvailable: Bool { model != nil }

    /// Class probabilities for one channel-major [1, 12, 125] window (see ClassifierInput).
    func predict(_ window: [Float]) -> [String: Double]? {
        let shape = [1, ClassifierInput.channelCount, ClassifierInput.windowSize].map { NSNumber(value: $0) }
        guard let model, window.count == ClassifierInput.channelCount * ClassifierInput.windowSize,
              let array = try? MLMultiArray(shape: shape, dataType: .float32) else { return nil }
        for (i, v) in window.enumerated() { array[i] = NSNumber(value: v) }
        guard let input = try? MLDictionaryFeatureProvider(dictionary: [inputName: MLFeatureValue(multiArray: array)]),
              let output = try? model.prediction(from: input) else { return nil }
        // The classifier's probability output is the one dictionary-typed feature, whatever it was named.
        for name in output.featureNames {
            guard let probabilities = output.featureValue(for: name)?.dictionaryValue, !probabilities.isEmpty else { continue }
            return probabilities.reduce(into: [:]) { result, entry in
                if let label = entry.key as? String { result[label] = entry.value.doubleValue }
            }
        }
        return nil
    }
}
