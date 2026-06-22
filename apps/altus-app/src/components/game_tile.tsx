import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';

import { StyleSheet, useStyles } from '@/components/theme_style';
import { fetchProduct, useProductInfo } from '@/stores/product_store';

import type { Title } from '@/lib/xcloud_api';

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    backgroundColor: 'var(--form-box-bg)',
    borderColor: 'var(--form-box-border)',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 5,
    overflow: 'hidden',
  },
  fallbackText: {
    color: 'var(--secondary-text-color)',
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
    textAlign: 'center',
  },
  image: { height: '100%', position: 'absolute', width: '100%' },
});

interface Props {
  title: Title;
}

export default function GameTile({ title }: Props) {
  const s = useStyles(styles);
  const product = useProductInfo(title.details.productId);

  useEffect(() => {
    void fetchProduct(title.details.productId);
  }, [title.details.productId]);

  const imageUri = product?.imageTile
    ? `https:${product.imageTile}?w=200`
    : null;

  return (
    <View style={s.container}>
      <Text selectable numberOfLines={3} style={s.fallbackText}>
        {product?.productTitle ?? title.titleId}
      </Text>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={s.image} resizeMode='cover' />
      ) : null}
    </View>
  );
}
