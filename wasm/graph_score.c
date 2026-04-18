float dot(const float* a, const float* b, int len) {
  float sum = 0.0f;
  for (int i = 0; i < len; ++i) {
    sum += a[i] * b[i];
  }
  return sum;
}

float l2(const float* a, int len) {
  float sum = 0.0f;
  for (int i = 0; i < len; ++i) {
    sum += a[i] * a[i];
  }
  return sum;
}
