export function measurePerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();

    console.log(`Méthode ${propertyKey} exécutée en ${(end - start).toFixed(2)}ms`);

    return result;
  };

  return descriptor;
}

export function logMethod(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(`Appel de la méthode ${propertyKey} avec les arguments:`, args);
    const result = originalMethod.apply(this, args);
    console.log(`Résultat de la méthode ${propertyKey}:`, result);
    return result;
  };

  return descriptor;
}

export function catchErrors(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    try {
      return originalMethod.apply(this, args);
    } catch (error) {
      console.error(`Erreur dans la méthode ${propertyKey}:`, error);
      throw error;
    }
  };

  return descriptor;
}
