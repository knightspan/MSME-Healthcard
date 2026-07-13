# Dataset

`train.py` expects `cs-training.csv` here — the public **"Give Me Some
Credit"** Kaggle dataset (150,000 labelled borrowers, real 2-year
delinquency outcomes). It's not committed to the repo (7.5MB, and it's
someone else's dataset to redistribute).

Fetch it with either:

```bash
# Kaggle CLI (needs a kaggle.json API key)
kaggle competitions download -c GiveMeSomeCredit -f cs-training.csv -p .

# or a GitHub mirror
curl -L -o cs-training.csv "https://raw.githubusercontent.com/JLZml/Credit-Scoring-Data-Sets/master/3.%20Kaggle/Give%20Me%20Some%20Credit/cs-training.csv"
```

Then run `python3 ../src/train.py` from `ml-service/`.
