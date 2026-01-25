"""ML inference service for bet/trade grading."""

from typing import Any, Dict, List, Optional

import numpy as np
import torch
import torch.nn as nn

from core.config import settings


class TradeGradingModel(nn.Module):
    """PyTorch model for grading trade predictions."""

    def __init__(self, input_size: int = 32, hidden_size: int = 64, output_size: int = 2):
        super().__init__()
        
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_size, output_size),
            nn.Softmax(dim=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class MLInferenceService:
    """Service for running ML model inference."""

    def __init__(self) -> None:
        self._model: Optional[TradeGradingModel] = None
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def _load_model(self) -> TradeGradingModel:
        """Load the trained model from disk."""
        if self._model is not None:
            return self._model

        self._model = TradeGradingModel()
        
        # Try to load saved weights
        model_path = f"{settings.ml_model_path}/trade_grading.pt"
        try:
            state_dict = torch.load(model_path, map_location=self._device)
            self._model.load_state_dict(state_dict)
            print(f"Loaded model from {model_path}")
        except FileNotFoundError:
            print("No saved model found, using random weights")
        
        self._model.to(self._device)
        self._model.eval()
        
        return self._model

    def _prepare_features(self, trade_data: Dict[str, Any]) -> torch.Tensor:
        """
        Prepare input features from trade data.
        
        Features could include:
        - Price momentum indicators
        - Volume patterns
        - Market sentiment
        - Technical indicators (RSI, MACD, etc.)
        - Time-based features
        """
        # Placeholder feature extraction
        # In production, this would compute real features
        features = np.zeros(32, dtype=np.float32)
        
        # Example feature assignments
        if "entry_price" in trade_data:
            features[0] = trade_data["entry_price"]
        if "volume" in trade_data:
            features[1] = trade_data["volume"]
        if "rsi" in trade_data:
            features[2] = trade_data["rsi"]
        
        return torch.tensor(features).unsqueeze(0).to(self._device)

    async def predict_trade_outcome(
        self,
        trade_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Predict the outcome of a trade.
        
        Args:
            trade_data: Dict containing trade information
            
        Returns:
            Dict with prediction and confidence
        """
        model = self._load_model()
        features = self._prepare_features(trade_data)

        with torch.no_grad():
            output = model(features)
            probabilities = output.cpu().numpy()[0]
        
        # Class 0 = loss, Class 1 = win
        win_probability = float(probabilities[1])
        prediction = "win" if win_probability > 0.5 else "loss"
        confidence = max(probabilities)

        return {
            "prediction": prediction,
            "confidence": float(confidence),
            "win_probability": win_probability,
            "loss_probability": float(probabilities[0]),
        }

    async def batch_predict(
        self,
        trades: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Batch prediction for multiple trades.
        
        Args:
            trades: List of trade data dicts
            
        Returns:
            List of predictions
        """
        model = self._load_model()
        
        # Prepare batch
        batch_features = torch.stack([
            self._prepare_features(trade).squeeze(0)
            for trade in trades
        ]).to(self._device)

        with torch.no_grad():
            outputs = model(batch_features)
            probabilities = outputs.cpu().numpy()

        results = []
        for prob in probabilities:
            win_prob = float(prob[1])
            results.append({
                "prediction": "win" if win_prob > 0.5 else "loss",
                "confidence": float(max(prob)),
                "win_probability": win_prob,
                "loss_probability": float(prob[0]),
            })

        return results


# Global service instance
ml_service = MLInferenceService()
