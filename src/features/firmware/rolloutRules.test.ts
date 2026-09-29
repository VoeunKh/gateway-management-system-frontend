import { checkRolloutForm, parseWaves } from './rolloutRules';

const form = (waves: string, threshold = '10') => ({
  model: 'GW200',
  version: '1.3.0',
  waves,
  threshold,
});

describe('parseWaves', () => {
  it('reads whole percentages, ignoring spaces', () => {
    expect(parseWaves('1, 10,50 ,100')).toEqual([1, 10, 50, 100]);
  });

  it.each(['', '1,,100', 'a,100', '0,100', '1,101', '1.5,100', '-1,100'])('rejects %j', (text) => {
    expect(parseWaves(text)).toBeNull();
  });
});

describe('checkRolloutForm', () => {
  it('accepts the default plan and builds the request', () => {
    expect(checkRolloutForm(form('1,10,50,100'))).toEqual({
      request: {
        model_id: 'GW200',
        fw_version: '1.3.0',
        waves: [1, 10, 50, 100],
        failure_threshold: 10,
      },
    });
  });

  it('accepts a single wave of 100', () => {
    expect(checkRolloutForm(form('100')).request?.waves).toEqual([100]);
  });

  it('says waves must end at 100', () => {
    expect(checkRolloutForm(form('1,10,50'))).toMatchObject({
      wavesError: 'Waves must end at 100.',
    });
    expect(checkRolloutForm(form('1,10,50')).request).toBeUndefined();
  });

  it('says waves must go up, including equal neighbours', () => {
    expect(checkRolloutForm(form('50,10,100')).wavesError).toBe(
      'Waves must go up, like 1,10,50,100.',
    );
    expect(checkRolloutForm(form('10,10,100')).wavesError).toBe(
      'Waves must go up, like 1,10,50,100.',
    );
  });

  it('asks for whole percentages when the text is not', () => {
    expect(checkRolloutForm(form('ten,100')).wavesError).toContain('whole percentages');
  });

  it.each(['0', '101', '', '5.5', 'x'])('rejects a failure threshold of %j', (threshold) => {
    const result = checkRolloutForm(form('1,100', threshold));
    expect(result.thresholdError).toBe('Failure threshold must be between 1 and 100.');
    expect(result.request).toBeUndefined();
  });

  it('accepts thresholds 1 and 100', () => {
    expect(checkRolloutForm(form('100', '1')).request?.failure_threshold).toBe(1);
    expect(checkRolloutForm(form('100', '100')).request?.failure_threshold).toBe(100);
  });

  it('builds no request without a model or version', () => {
    expect(checkRolloutForm({ ...form('100'), version: '' }).request).toBeUndefined();
  });
});
