import React, { useEffect } from 'react';
import { Image, PixelRatio, Text, View } from 'react-native';

import { StyleSheet, useStyles } from '@/components/theme_style';
import { fetchProduct, useProductInfo } from '@/stores/product_store';

import type { Title } from '@/lib/xcloud_api';
import type { ViewStyle } from 'react-native';

const SIZE = PixelRatio.getPixelSizeForLayoutSize(200);

const styles = StyleSheet.create({
  fallbackText: {
    color: 'var(--secondary-text-color)',
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
    textAlign: 'center',
  },
  gameTile: {
    aspectRatio: 1,
    backgroundColor: 'var(--form-box-bg)',
    borderColor: 'var(--form-box-border)',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { height: '100%', position: 'absolute', width: '100%' },
});

interface Props {
  style?: ViewStyle;
  title: Title;
}
export default function GameTile({ title, style }: Props) {
  const s = useStyles(styles);
  const product = useProductInfo(title.details.productId);

  useEffect(() => {
    void fetchProduct(title.details.productId);
  }, [title.details.productId]);

  const imageUri = product?.imageTile
    ? `https:${product.imageTile}?w=${SIZE}`
    : null;

  return (
    <View style={[s.gameTile, style]}>
      <Text selectable numberOfLines={3} style={s.fallbackText}>
        {product?.productTitle ?? title.titleId}
      </Text>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={s.image} resizeMode='cover' />
      ) : null}
    </View>
  );
}
