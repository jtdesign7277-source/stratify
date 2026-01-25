"""Trade grading model training script."""

import json
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset, random_split

from core.config import settings


class TradeGradingModel(nn.Module):
    """PyTorch model for grading trade predictions."""

    def __init__(self, input_size: int = 32, hidden_size: int = 64, output_size: int = 2):
        super().__init__()
        
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            
            nn.Linear(hidden_size, hidden_size),
            nn.BatchNorm1d(hidden_size),
            nn.ReLU(),
            nn.Dropout(0.3),
            
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            
            nn.Linear(hidden_size // 2, output_size),
            nn.Softmax(dim=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class TradeDataset(Dataset):
    """Dataset for trade data."""

    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.long)

    def __len__(self) -> int:
        return len(self.features)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.features[idx], self.labels[idx]


def extract_features(trade_data: pd.DataFrame) -> np.ndarray:
    """
    Extract features from trade data.
    
    Features to consider:
    - Price momentum (returns over different windows)
    - Volume patterns
    - Technical indicators (RSI, MACD, Bollinger Bands)
    - Time-based features (hour, day of week)
    - Market regime indicators
    """
    features = []
    
    for _, row in trade_data.iterrows():
        feature_vector = np.zeros(32, dtype=np.float32)
        
        # Price features
        if "entry_price" in row:
            feature_vector[0] = row["entry_price"]
        if "volume" in row:
            feature_vector[1] = np.log1p(row["volume"])
        
        # Technical indicators
        if "rsi" in row:
            feature_vector[2] = row["rsi"] / 100  # Normalize to 0-1
        if "macd" in row:
            feature_vector[3] = row["macd"]
        
        # Momentum
        if "return_1d" in row:
            feature_vector[4] = row["return_1d"]
        if "return_5d" in row:
            feature_vector[5] = row["return_5d"]
        
        # Volatility
        if "volatility" in row:
            feature_vector[6] = row["volatility"]
        
        features.append(feature_vector)
    
    return np.array(features)


def train_model(
    train_data: pd.DataFrame,
    epochs: int = 100,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    save_path: str = None,
) -> TradeGradingModel:
    """
    Train the trade grading model.
    
    Args:
        train_data: DataFrame with trade data and outcomes
        epochs: Number of training epochs
        batch_size: Batch size for training
        learning_rate: Learning rate
        save_path: Path to save the trained model
        
    Returns:
        Trained model
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on {device}")

    # Extract features and labels
    features = extract_features(train_data)
    labels = train_data["outcome"].values  # 0 = loss, 1 = win

    # Create dataset
    dataset = TradeDataset(features, labels)
    
    # Split into train/val
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # Initialize model
    model = TradeGradingModel(input_size=32, hidden_size=64, output_size=2)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", patience=10, factor=0.5
    )

    best_val_loss = float("inf")
    best_model_state = None

    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0.0
        
        for batch_features, batch_labels in train_loader:
            batch_features = batch_features.to(device)
            batch_labels = batch_labels.to(device)

            optimizer.zero_grad()
            outputs = model(batch_features)
            loss = criterion(outputs, batch_labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0

        with torch.no_grad():
            for batch_features, batch_labels in val_loader:
                batch_features = batch_features.to(device)
                batch_labels = batch_labels.to(device)

                outputs = model(batch_features)
                loss = criterion(outputs, batch_labels)
                val_loss += loss.item()

                _, predicted = torch.max(outputs, 1)
                total += batch_labels.size(0)
                correct += (predicted == batch_labels).sum().item()

        avg_train_loss = train_loss / len(train_loader)
        avg_val_loss = val_loss / len(val_loader)
        accuracy = 100 * correct / total

        scheduler.step(avg_val_loss)

        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_model_state = model.state_dict().copy()

        if (epoch + 1) % 10 == 0:
            print(
                f"Epoch [{epoch+1}/{epochs}] "
                f"Train Loss: {avg_train_loss:.4f} "
                f"Val Loss: {avg_val_loss:.4f} "
                f"Accuracy: {accuracy:.2f}%"
            )

    # Load best model
    if best_model_state:
        model.load_state_dict(best_model_state)

    # Save model
    if save_path:
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), save_path)
        print(f"Model saved to {save_path}")

    return model


if __name__ == "__main__":
    # Example usage with dummy data
    print("Creating dummy training data...")
    
    np.random.seed(42)
    n_samples = 1000
    
    dummy_data = pd.DataFrame({
        "entry_price": np.random.uniform(10, 500, n_samples),
        "volume": np.random.randint(1000, 1000000, n_samples),
        "rsi": np.random.uniform(20, 80, n_samples),
        "macd": np.random.uniform(-5, 5, n_samples),
        "return_1d": np.random.uniform(-0.05, 0.05, n_samples),
        "return_5d": np.random.uniform(-0.15, 0.15, n_samples),
        "volatility": np.random.uniform(0.01, 0.1, n_samples),
        "outcome": np.random.randint(0, 2, n_samples),  # 0 = loss, 1 = win
    })
    
    print("Training model...")
    model = train_model(
        dummy_data,
        epochs=50,
        batch_size=32,
        save_path=f"{settings.ml_model_path}/trade_grading.pt",
    )
    
    print("✅ Training complete!")
